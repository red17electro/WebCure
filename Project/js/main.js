/**
 * Register Service Worker and manipulate the content on load
 */

/**
 * Initialize the database, Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', event => {
  DBHelper.getDB();
});

/*global DBHelper Logger log crdt_set_aw:true*/

window.addEventListener('load', () => {
  registerServiceWorker();
  Logger.show();
  Logger.open();
  addCounterForm();
  addSetForm();
});

/*
 * Subscribe for the sync event
 */

const requestSync = () => {
  navigator.serviceWorker.ready
    .then(function(swRegistration) {
      return swRegistration.sync.register('syncChanges');
    })
    .catch(function(error) {
      console.log(error);
    });
};

/*
* Generate an array of alphabet symbols 
*/

const genCharArray = (charA, charZ) => {
  var a = [],
    i = charA.charCodeAt(0),
    j = charZ.charCodeAt(0);
  for (; i <= j; ++i) {
    a.push(String.fromCharCode(i));
  }
  return a;
};

/**
 * Add the form for interacting with a counter CRDT
 *
 */
const addCounterForm = () => {
  const mainContainer = document.getElementById('counter-options');
  const form = document.createElement('form');
  const li = document.createElement('ul');

  const liName = document.createElement('li');

  const name = document.createElement('input');
  name.type = 'text';
  name.name = 'name';
  name.id = 'name-field';
  name.placeholder = 'Enter the variable name';

  const labelName = document.createElement('label');
  labelName.setAttribute('for', name.id);

  liName.appendChild(labelName);
  liName.appendChild(document.createElement('br'));
  liName.appendChild(name);

  /**
   * Creating the 'get' button:
   */

  const liGetBtn = document.createElement('li');

  const getBtn = document.createElement('button');
  getBtn.id = 'getbtn-field';
  getBtn.innerHTML = 'Get Counter!';
  getBtn.type = 'button';

  const labelGetBtn = document.createElement('label');
  labelGetBtn.setAttribute('for', getBtn.id);

  liGetBtn.appendChild(labelGetBtn);
  liGetBtn.appendChild(document.createElement('br'));
  liGetBtn.appendChild(getBtn);

  getBtn.onclick = function() {
    log(`Getting ${name.value}`);
    fetch(`${DBHelper.SERVER_URL}/api/1/count/${name.value}`, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
      .then(function(response) {
        return response.json();
      })
      .then(function(json) {
        DBHelper.crdtDBPromise
          .then(function(db) {
            if (!db) return;

            var tx = db.transaction('crdt-states', 'readwrite');
            var store = tx.objectStore('crdt-states');

            var item = {
              id: name.value,
              value: json.cont
            };

            store.put(item);

            return tx.complete;
          })
          .then(function() {
            DBHelper.crdtDBPromise
              .then(function(db) {
                if (!db) return;

                var tx = db.transaction('crdt-operations', 'readwrite');
                var store = tx.objectStore('crdt-operations');

                return store.openCursor();
              })
              .then(function cleanOperationsDB(cursor) {
                if (!cursor) return;
                cursor.delete(cursor.value);
                return cursor.continue().then(cleanOperationsDB);
              });
          });
        log(`The value of ${name.value} is: ${json.cont}`);
      })
      .catch(function() {
        var statesCached = [];
        DBHelper.crdtDBPromise
          .then(function(db) {
            if (!db) return;

            var index = db.transaction('crdt-states').objectStore('crdt-states');

            return index.getAll().then(function(states) {
              statesCached = states;
              var index = db.transaction('crdt-operations').objectStore('crdt-operations');

              return index.get(name.value).then(function(value) {
                var counter = 0;
                statesCached.forEach(state => {
                  if (state.id === name.value) {
                    if (value) {
                      var operations = value.operations;
                      var sentOperations = value.sentOperations;

                      if (operations) {
                        operations.forEach(operation => {
                          counter = counter + operation;
                        });
                      }

                      if (sentOperations) {
                        sentOperations.forEach(operation => {
                          counter = counter + operation;
                        });
                      }
                    }

                    counter += state.value;

                    log(`[Offline] The value of ${name.value} is: ${counter}`);
                  }
                });
              });
            });
          })
          .catch(function() {
            // TODO throw an error
          });
      });
  };

  /**
   * Creating the 'inc' button:
   */

  const liIncBtn = document.createElement('li');

  const incBtn = document.createElement('button');
  incBtn.id = 'incbtn-field';
  incBtn.innerHTML = 'Inc Counter!';
  incBtn.type = 'button';

  const labelIncBtn = document.createElement('label');
  labelIncBtn.setAttribute('for', incBtn.id);

  liIncBtn.appendChild(labelIncBtn);
  liIncBtn.appendChild(document.createElement('br'));
  liIncBtn.appendChild(incBtn);

  incBtn.onclick = function() {
    requestSync();
    log(`Incrementing the value of ${name.value}`);
    fetch(`${DBHelper.SERVER_URL}/api/1/count/${name.value}`, {
      method: 'PUT',
      data: `value=${1}`,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
      .then(function(response) {
        return response.json();
      })
      .then(function() {
        //log(`The response for id ${name.value} is: ${json.status}`);
      })
      .catch(function(error) {
        DBHelper.crdtDBPromise
          .then(function(db) {
            if (!db) return;

            var index = db.transaction('crdt-operations').objectStore('crdt-operations');

            return index.get(name.value).then(function(val) {
              var tx = db.transaction('crdt-operations', 'readwrite');
              var store = tx.objectStore('crdt-operations');
              if (!val) {
                store.put({
                  id: name.value,
                  operations: [1]
                });
              } else {
                var temp = val;

                if (!temp.operations) {
                  temp.operations = [];
                }

                temp.operations.push(1);

                store.put(temp);
              }

              return tx.complete;
            });
          })
          .catch(function() {
            // TODO throw an error
          });

        //log(`Failed to increment the id ${name.value}: ${error}`);
      });
  };

  /**
   * Creating the 'dec' button:
   */

  const liDecBtn = document.createElement('li');

  const decBtn = document.createElement('button');
  decBtn.id = 'decbtn-field';
  decBtn.innerHTML = 'Dec Counter!';
  decBtn.type = 'button';

  const labelDecBtn = document.createElement('label');
  labelDecBtn.setAttribute('for', decBtn.id);

  liDecBtn.appendChild(labelDecBtn);
  liDecBtn.appendChild(document.createElement('br'));
  liDecBtn.appendChild(decBtn);

  decBtn.onclick = function() {
    requestSync();
    log(`Decrementing the value of ${name.value}`);
    fetch(`${DBHelper.SERVER_URL}/api/1/count/${name.value}`, {
      method: 'DELETE',
      data: `value=${1}`,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
      .then(function(response) {
        return response.json();
      })
      .then(function() {
        //log(`The response for id ${name.value} is: ${json.status}`);
      })
      .catch(function(error) {
        DBHelper.crdtDBPromise
          .then(function(db) {
            if (!db) return;

            var index = db.transaction('crdt-operations').objectStore('crdt-operations');

            return index.get(name.value).then(function(val) {
              var tx = db.transaction('crdt-operations', 'readwrite');
              var store = tx.objectStore('crdt-operations');
              if (!val) {
                store.put({
                  id: name.value,
                  operations: [-1]
                });
              } else {
                var temp = val;

                if (!temp.operations) {
                  temp.operations = [];
                }

                temp.operations.push(-1);

                store.put(temp);
              }

              return tx.complete;
            });
          })
          .catch(function() {
            // TODO throw an error
          });

        //log(`Failed to increment the id ${name.value}: ${error}`);
      });
  };

  // Add everything to the form
  li.appendChild(liName);
  li.appendChild(liGetBtn);
  li.appendChild(liIncBtn);
  li.appendChild(liDecBtn);
  form.appendChild(li);
  mainContainer.appendChild(form);
};

/**
 * Add the form for interacting with a sets-aw CRDT
 *
 */
const addSetForm = () => {
  const mainContainer = document.getElementById('set_aw-options');
  const form = document.createElement('form');
  const li = document.createElement('ul');

  const liName = document.createElement('li');

  const name = document.createElement('input');
  name.type = 'text';
  name.name = 'name';
  name.id = 'set-name-field';
  name.placeholder = 'Enter the set name';

  const labelName = document.createElement('label');
  labelName.setAttribute('for', name.id);

  liName.appendChild(labelName);
  liName.appendChild(document.createElement('br'));
  liName.appendChild(name);

  const liValue = document.createElement('li');

  const value = document.createElement('input');
  value.type = 'text';
  value.name = 'value';
  value.id = 'set-value-field';
  value.placeholder = 'Enter the object to add';

  const labelValue = document.createElement('label');
  labelValue.setAttribute('for', value.id);

  liValue.appendChild(labelValue);
  liValue.appendChild(document.createElement('br'));
  liValue.appendChild(value);

  /**
   * Creating the 'get' button:
   */

  const liGetBtn = document.createElement('li');

  const getBtn = document.createElement('button');
  getBtn.id = 'set-getbtn-field';
  getBtn.innerHTML = 'Get Set!';
  getBtn.type = 'button';

  const labelGetBtn = document.createElement('label');
  labelGetBtn.setAttribute('for', getBtn.id);

  liGetBtn.appendChild(labelGetBtn);
  liGetBtn.appendChild(document.createElement('br'));
  liGetBtn.appendChild(getBtn);

  getBtn.onclick = function() {
    debugger;
    log(`Getting ${name.value} set`);
    fetch(`${DBHelper.SERVER_URL}/api/1/set/${name.value}`, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
      .then(function(response) {
        return response.json();
      })
      .then(function(json) {
        DBHelper.crdtDBPromise
          .then(function(db) {
            debugger;
            if (!db) return;

            var tx = db.transaction('crdt-set-states', 'readwrite');
            var store = tx.objectStore('crdt-set-states');
            //var set = crdt_set_aw.initialState();
            var keys = [];
            json.cont.forEach(element => {
              keys.push([element, '']);
            });
            //

            var item = {
              id: name.value,
              value: {
                state: new Map(keys)
              }
            };

            store.put(item);

            return tx.complete;
          })
          .then(function() {
            // TODO
            /*             DBHelper.crdtDBPromise
              .then(function(db) {
                if (!db) return;

                var tx = db.transaction('crdt-operations', 'readwrite');
                var store = tx.objectStore('crdt-operations');

                return store.openCursor();
              })
              .then(function cleanOperationsDB(cursor) {
                if (!cursor) return;
                cursor.delete(cursor.value);
                return cursor.continue().then(cleanOperationsDB);
              }); */
          });
        log(`The value of ${name.value} is: [ ${json.cont} ]`);
      })
      .catch(function() {
        debugger;
        var statesCached = [];
        DBHelper.crdtDBPromise
          .then(function(db) {
            if (!db) return;

            var index = db.transaction('crdt-set-states').objectStore('crdt-set-states');

            return index.getAll().then(function(states) {
              statesCached = states;
              //var index = db.transaction('crdt-set-operations').objectStore('crdt-set-operations');

              //return index.get(name.value).then(function(value) {
              //var counter = 0;
              statesCached.forEach(state => {
                //if (state.id === name.value) {
                /*                     if (value) {
                      var operations = value.operations;
                      var sentOperations = value.sentOperations;

                      if (operations) {
                        operations.forEach(operation => {
                          counter = counter + operation;
                        });
                      }

                      if (sentOperations) {
                        sentOperations.forEach(operation => {
                          counter = counter + operation;
                        });
                      }
                    }

                    counter += state.value; */

                log(`[Offline] The value of ${name.value} is: ${crdt_set_aw.value(state.value)}`);
                // }
              });

              //});
            });
          })
          .catch(function() {
            // TODO throw an error
          });
      });
  };

  /**
   * Creating the 'inc' button:
   */

  const liAddBtn = document.createElement('li');

  const addBtn = document.createElement('button');
  addBtn.id = 'incbtn-field';
  addBtn.innerHTML = 'Add to the set!';
  addBtn.type = 'button';

  const labelIncBtn = document.createElement('label');
  labelIncBtn.setAttribute('for', addBtn.id);

  liAddBtn.appendChild(labelIncBtn);
  liAddBtn.appendChild(document.createElement('br'));
  liAddBtn.appendChild(addBtn);

  addBtn.onclick = function() {
    //requestSync();
    log(`Adding to the set ${name.value} the value of ${value.value}`);
    fetch(`${DBHelper.SERVER_URL}/api/1/set/${name.value}`, {
      method: 'PUT',
      body: JSON.stringify({ value: value.value }),
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
      .then(function(response) {
        return response.json();
      })
      .then(function() {
        //log(`The response for id ${name.value} is: ${json.status}`);
      })
      .catch(function(error) {
        /*         DBHelper.crdtDBPromise
          .then(function(db) {
            if (!db) return;

            var index = db.transaction('crdt-operations').objectStore('crdt-operations');

            return index.get(name.value).then(function(val) {
              var tx = db.transaction('crdt-operations', 'readwrite');
              var store = tx.objectStore('crdt-operations');
              if (!val) {
                store.put({
                  id: name.value,
                  operations: [1]
                });
              } else {
                var temp = val;

                if (!temp.operations) {
                  temp.operations = [];
                }

                temp.operations.push(1);

                store.put(temp);
              }

              return tx.complete;
            });
          })
          .catch(function() {
            // TODO throw an error
          }); */
        //log(`Failed to increment the id ${name.value}: ${error}`);
      });
  };

  /**
   * Creating the 'dec' button:
   */

  const liDecBtn = document.createElement('li');

  const decBtn = document.createElement('button');
  decBtn.id = 'decbtn-field';
  decBtn.innerHTML = 'Remove from the set!';
  decBtn.type = 'button';

  const labelDecBtn = document.createElement('label');
  labelDecBtn.setAttribute('for', decBtn.id);

  liDecBtn.appendChild(labelDecBtn);
  liDecBtn.appendChild(document.createElement('br'));
  liDecBtn.appendChild(decBtn);

  decBtn.onclick = function() {
    requestSync();
    log(`Removing from the set ${name.value} the value of ${value.value}`);
    fetch(`${DBHelper.SERVER_URL}/api/1/set/${name.value}`, {
      method: 'DELETE',
      body: JSON.stringify({ value: value.value }),
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
      .then(function(response) {
        return response.json();
      })
      .then(function() {
        //log(`The response for id ${name.value} is: ${json.status}`);
      })
      .catch(function(error) {
        /*         DBHelper.crdtDBPromise
          .then(function(db) {
            if (!db) return;

            var index = db.transaction('crdt-operations').objectStore('crdt-operations');

            return index.get(name.value).then(function(val) {
              var tx = db.transaction('crdt-operations', 'readwrite');
              var store = tx.objectStore('crdt-operations');
              if (!val) {
                store.put({
                  id: name.value,
                  operations: [-1]
                });
              } else {
                var temp = val;

                if (!temp.operations) {
                  temp.operations = [];
                }

                temp.operations.push(-1);

                store.put(temp);
              }

              return tx.complete;
            });
          })
          .catch(function() {
            // TODO throw an error
          }); */
        //log(`Failed to increment the id ${name.value}: ${error}`);
      });
  };

  // Add everything to the form
  li.appendChild(liName);
  li.appendChild(liValue);
  li.appendChild(liGetBtn);
  li.appendChild(liAddBtn);
  li.appendChild(liDecBtn);
  form.appendChild(li);
  mainContainer.appendChild(form);
};

/**
 * Register a service worker
 */

const registerServiceWorker = () => {
  if (!navigator.serviceWorker) return;

  navigator.serviceWorker
    .register('/sw.js')
    .then(function() {
      console.log('Service Worker registered!');
    })
    .catch(function() {
      console.log('Registration of the Service Worker failed');
    });
};
