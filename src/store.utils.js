/*eslint no-console: ["error", { allow: ["warn", "error"] }] */

import { observable, action } from 'mobx';

export function appStateReducer(stores) {
  return Object.keys(stores).reduce( (state, key) => {
    // mobx.observable() applies itself recursively by default,
    // so all fields inside the store are observable
    const store = observable(stores[key].store);
    const actions = stores[key].actions;

    state[key] = {
      store: store,
      actions: actions
    };

    return state;
  }, {});
}

/**
 * Dispach an action to a defined store
 * @param  {string} store   Store name
 * @param  {string} action  Action name
 * @param  {any} payload Payload data. Optional
 * @return {Object}         Store object
 */
export function dispatch(appState, {store, action: actionName, payload}) {
  if (appState[store] && appState[store].actions && appState[store].actions[actionName]) {
    const storeAction = appState[store].actions[actionName];

    action(storeAction.bind(appState[store], [payload]))();

    return appState[store];
  }

  console.warn(`No action "${action}" for "${store}" store`);
}

/**
 * Get a deep property value from a store
 * @param  {string} store
 * @param  {string} path  Example: path.subpath.subsubpath
 * @return {any}
 */
export function deepPathCheck(appState, store, path) {
  const pathArray = path.split('.');

  const appStateValue = pathArray.reduce((prev, next) => {
    if (prev === undefined) {
      return;
    }

    const nextPath = prev[next];
    // TODO: Use hasOwnProperty() method
    if (nextPath !== undefined) {
      return nextPath;
    }
  }, appState[store].store);

  return appStateValue;
}
