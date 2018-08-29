/**
 * Register Service Worker and manipulate the content on load
 */

/**
 * Initialize the database, Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', event => {
  DBHelper.getDB();
});

/*global DBHelper Logger log CounterCRDT SetCRDT:true*/

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

const requestCounterSync = () => {
  navigator.serviceWorker.ready
    .then(function(swRegistration) {
      return swRegistration.sync.register('syncCounterChanges');
    })
    .catch(function(error) {
      console.log(error);
    });
};

/*
 * Subscribe for the sync event
 */

const requestSetSync = () => {
  navigator.serviceWorker.ready
    .then(function(swRegistration) {
      return swRegistration.sync.register('syncSetChanges');
    })
    .catch(function(error) {
      console.log(error);
    });
};

/* 
 * Fill in the select elements 
*/

const fillSelectsEls = elementDoms => {
  elementDoms.forEach(elementDom => {
    elementDom.innerHTML = '';
    DBHelper.crdtDBPromise.then(function(db) {
      if (!db) return;

      var index = db.transaction('crdt-states').objectStore('crdt-states');

      return index.getAll().then(function(states) {
        var selectOptions = [],
          i = 'a'.charCodeAt(0),
          j = 'z'.charCodeAt(0);

        for (; i <= j; ++i) {
          selectOptions.push(String.fromCharCode(i));
        }

        states.forEach(state => {
          if (elementDom.id.indexOf(state.type) === -1) {
            selectOptions = selectOptions.filter(item => item !== state.id);
          }
        });

        selectOptions.forEach(element => {
          const option = document.createElement('option');
          option.value = element;
          option.innerHTML = element;
          elementDom.appendChild(option);
        });
      });
    });
  });
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

  const name = document.createElement('select');
  name.name = 'name';
  name.id = 'counter-name-field';
  name.placeholder = 'Enter the variable name';

  fillSelectsEls([name]);

  const labelName = document.createElement('label');
  labelName.setAttribute('for', name.id);

  liName.appendChild(labelName);
  liName.appendChild(document.createElement('br'));
  liName.appendChild(name);

  const liTimestamp = document.createElement('li');

  const timestamp = document.createElement('input');
  timestamp.type = 'text';
  timestamp.name = 'timestamp';
  timestamp.id = 'count-timestamp-field';
  timestamp.placeholder = 'Enter the timestamp to read (optional)';

  const labelTimestamp = document.createElement('label');
  labelTimestamp.setAttribute('for', timestamp.id);

  liTimestamp.appendChild(labelTimestamp);
  liTimestamp.appendChild(document.createElement('br'));
  liTimestamp.appendChild(timestamp);

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

    var fetchCounter = function() {
      if (timestamp.value === '') {
        return fetch(`${DBHelper.SERVER_URL}/api/count/${name.value}`, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      } else {
        return fetch(`${DBHelper.SERVER_URL}/api/count/${name.value}/timestamp`, {
          method: 'PUT',
          body: JSON.stringify({ timestamp: timestamp.value }),
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      }
    };

    fetchCounter()
      .then(function(response) {
        return response.json();
      })
      .then(function(json) {
        DBHelper.crdtDBPromise
          .then(function(db) {
            if (!db) return;

            var tx = db.transaction('crdt-states', 'readwrite');
            var store = tx.objectStore('crdt-states');

            var item = new CounterCRDT(name.value, json.cont);

            store.put(item);

            let setSelector = document.getElementById('set-name-field');
            fillSelectsEls([name, setSelector]);
            return tx.complete;
          })
          .then(function() {
            DBHelper.crdtDBPromise.then(function(db) {
              if (!db) return;

              var tx = db.transaction('crdt-timestamps', 'readwrite');
              var store = tx.objectStore('crdt-timestamps');
              var temp = json.lastCommitTimestamp;

              if (temp) {
                log(`Timestamp: ${temp}`);
                store.put({ id: 0, data: temp });
              }

              return tx.complete;
            });

            //     TODO       cleaning operations;
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
        log(`The value of ${name.value} is: ${json.cont}`);
      })
      .catch(function() {
        // TODO add the functionality when the key is not created yet and don't forget to recreate the select element
        DBHelper.crdtDBPromise
          .then(function(db) {
            if (!db) return;

            var index = db.transaction('crdt-states').objectStore('crdt-states');

            return index.get(name.value).then(function(state) {
              if (state) {
                Object.setPrototypeOf(state, CounterCRDT.prototype);

                log(`[Offline] The value of ${name.value} is: ${state.calculateState()}`);
              }
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
    requestCounterSync();
    log(`Incrementing the value of ${name.value}`);

    DBHelper.crdtDBPromise
      .then(function(db) {
        if (!db) return;
        var index = db.transaction('crdt-timestamps').objectStore('crdt-timestamps');
        return index.get(0).then(function(timestamp) {
          fetch(`${DBHelper.SERVER_URL}/api/count/${name.value}`, {
            method: 'PUT',
            body: JSON.stringify({
              // TODO decide whether you want to apply changes only on the timestamp that is stored in the web-browser
              // TODO FIX of the problem with adding and then removing a value from a set without pressing GET
              //              lastCommitTimestamp: timestamp ? timestamp : undefined
            }),
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

                  var index = db.transaction('crdt-states').objectStore('crdt-states');

                  return index.get(name.value).then(function(val) {
                    var tx = db.transaction('crdt-states', 'readwrite');
                    var store = tx.objectStore('crdt-states');

                    var item = val;

                    // TODO check on !val
                    Object.setPrototypeOf(item, CounterCRDT.prototype);

                    item.inc();
                    store.put(item);

                    return tx.complete;
                  });
                })
                .catch(function() {
                  // TODO throw an error
                });

              //log(`Failed to increment the id ${name.value}: ${error}`);
            });
        });
      })
      .catch(function() {
        // TODO throw an error
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
    requestCounterSync();
    log(`Decrementing the value of ${name.value}`);

    DBHelper.crdtDBPromise
      .then(function(db) {
        if (!db) return;
        var index = db.transaction('crdt-timestamps').objectStore('crdt-timestamps');
        return index.get(0).then(function(timestamp) {
          fetch(`${DBHelper.SERVER_URL}/api/count/${name.value}`, {
            method: 'DELETE',
            body: JSON.stringify({
              // TODO decide whether you want to apply changes only on the timestamp that is stored in the web-browser
              // TODO FIX of the problem with adding and then removing a value from a set without pressing GET
              //lastCommitTimestamp: timestamp ? timestamp : undefined
            }),
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

                  var index = db.transaction('crdt-states').objectStore('crdt-states');

                  return index.get(name.value).then(function(val) {
                    var tx = db.transaction('crdt-states', 'readwrite');
                    var store = tx.objectStore('crdt-states');

                    var item = val;
                    // TODO check on !val
                    Object.setPrototypeOf(item, CounterCRDT.prototype);

                    item.dec();
                    store.put(item);

                    return tx.complete;
                  });
                })
                .catch(function() {
                  // TODO throw an error
                });

              //log(`Failed to decrement the id ${name.value}: ${error}`);
            });
        });
      })
      .catch(function() {
        // TODO throw an error
      });
  };

  // Add everything to the form
  li.appendChild(liName);
  li.appendChild(liTimestamp);
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

  const name = document.createElement('select');
  name.name = 'name';
  name.id = 'set-name-field';
  name.placeholder = 'Enter the set name';

  fillSelectsEls([name]);

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

  const liTimestamp = document.createElement('li');

  const timestamp = document.createElement('input');
  timestamp.type = 'text';
  timestamp.name = 'timestamp';
  timestamp.id = 'set-timestamp-field';
  timestamp.placeholder = 'Enter the timestamp to read (optional)';

  const labelTimestamp = document.createElement('label');
  labelTimestamp.setAttribute('for', timestamp.id);

  liTimestamp.appendChild(labelTimestamp);
  liTimestamp.appendChild(document.createElement('br'));
  liTimestamp.appendChild(timestamp);

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
    log(`Getting ${name.value} set`);

    var fetchSet = function() {
      if (timestamp.value === '') {
        return fetch(`${DBHelper.SERVER_URL}/api/set/${name.value}`, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      } else {
        return fetch(`${DBHelper.SERVER_URL}/api/set/${name.value}/timestamp`, {
          method: 'PUT',
          body: JSON.stringify({ timestamp: timestamp.value }),
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      }
    };

    fetchSet()
      .then(function(response) {
        return response.json();
      })
      .then(function(json) {
        DBHelper.crdtDBPromise
          .then(function(db) {
            if (!db) return;

            var tx = db.transaction('crdt-states', 'readwrite');
            var store = tx.objectStore('crdt-states');

            var item = new SetCRDT(name.value, json.cont);

            store.put(item);
            let counterSelector = document.getElementById('counter-name-field');
            fillSelectsEls([name, counterSelector]);
            return tx.complete;
          })
          .then(function() {
            DBHelper.crdtDBPromise.then(function(db) {
              if (!db) return;

              var tx = db.transaction('crdt-timestamps', 'readwrite');
              var store = tx.objectStore('crdt-timestamps');
              var temp = json.lastCommitTimestamp;

              if (temp) {
                log(`Timestamp: ${temp}`);
                store.put({ id: 1, data: temp });
              }

              return tx.complete;
            });

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
        // TODO add the functionality when the key is not created yet and don't forget to recreate the select element
        DBHelper.crdtDBPromise
          .then(function(db) {
            if (!db) return;

            var index = db.transaction('crdt-states').objectStore('crdt-states');

            return index.get(name.value).then(function(state) {
              if (state) {
                Object.setPrototypeOf(state, SetCRDT.prototype);
                log(`[Offline] The value of ${name.value} is: [ ${state.calculateState()} ]`);
              }
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
    if (value.value !== '') {
      requestSetSync();
      log(`Adding to the set ${name.value} the value of ${value.value}`);

      DBHelper.crdtDBPromise
        .then(function(db) {
          if (!db) return;

          var index = db.transaction('crdt-timestamps').objectStore('crdt-timestamps');

          return index.get(1).then(function(timestamp) {
            fetch(`${DBHelper.SERVER_URL}/api/set/${name.value}`, {
              method: 'PUT',
              body: JSON.stringify({
                value: value.value
                // TODO decide whether you want to apply changes only on the timestamp that is stored in the web-browser
                // TODO FIX of the problem with adding and then removing a value from a set without pressing GET
                //lastCommitTimestamp: timestamp ? timestamp : undefined
              }),
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

                    var index = db.transaction('crdt-states').objectStore('crdt-states');

                    return index.get(name.value).then(function(val) {
                      var tx = db.transaction('crdt-states', 'readwrite');
                      var store = tx.objectStore('crdt-states');

                      var item = val;

                      Object.setPrototypeOf(item, SetCRDT.prototype);
                      item.add(value.value);
                      store.put(item);

                      return tx.complete;
                    });
                  })
                  .catch(function() {
                    // TODO throw an error
                  });
                //log(`Failed to increment the id ${name.value}: ${error}`);
              });
          });
        })
        .catch(function() {
          // TODO Throw an error
        });
    } else {
      alert('Please, fill in all the fields!');
    }
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
    if (value.value !== '') {
      requestSetSync();
      log(`Removing from the set ${name.value} the value of ${value.value}`);

      DBHelper.crdtDBPromise
        .then(function(db) {
          if (!db) return;

          var index = db.transaction('crdt-timestamps').objectStore('crdt-timestamps');

          return index.get(1).then(function(timestamp) {
            fetch(`${DBHelper.SERVER_URL}/api/set/${name.value}`, {
              method: 'DELETE',
              body: JSON.stringify({
                value: value.value
                // TODO decide whether you want to apply changes only on the timestamp that is stored in the web-browser
                // TODO FIX of the problem with adding and then removing a value from a set without pressing GET
                //lastCommitTimestamp: timestamp ? timestamp : undefined
              }),
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

                    var index = db.transaction('crdt-states').objectStore('crdt-states');

                    return index.get(name.value).then(function(val) {
                      var tx = db.transaction('crdt-states', 'readwrite');
                      var store = tx.objectStore('crdt-states');

                      var item = val;

                      Object.setPrototypeOf(item, SetCRDT.prototype);
                      item.remove(value.value);
                      store.put(item);

                      return tx.complete;
                    });
                  })
                  .catch(function() {
                    // TODO throw an error
                  });
                //log(`Failed to increment the id ${name.value}: ${error}`);
              });
          });
        })
        .catch(function() {
          // TODO throw an error
        });
    } else {
      alert('Please, fill in all the fields!');
    }
  };

  // Add everything to the form
  li.appendChild(liName);
  li.appendChild(liValue);
  li.appendChild(liTimestamp);
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
