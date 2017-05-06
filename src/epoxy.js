/*eslint no-console: ["error", { allow: ["warn", "error"] }] */

import { autorun, observable, extendObservable, action, toJS } from 'mobx';

export { toJS };

const appState = {};

/**
 * Create a mobx actions object
 * @param  {Object} actions Raw actions functions
 * @return {Object}         Mobx actions
 */
function actionsReducer(actions) {
  return Object.keys(actions).reduce( (prevActions, actionName) => {
    prevActions[actionName] = action.bound(actions[actionName]);

    return prevActions;
  }, {});
}

function getStore(state, storeName) {
  const { model, actions } = state[storeName];
  const fullStore = {
    model: toJS(model), // toJS to prevent changes in other stores?
    actions // Remove?
  };

  return fullStore;
}

function applyMiddlewares(middlewares, actionObject) {
  middlewares.forEach(middleware => {
    middleware(appState, actionObject);
  });
}

/**
 * Iterates through a polymer element properties to find statePath atribute
 * subscribing it to state mutations
 *
 * @memberof Epoxy
 * @param {Object} appState
 * @param {Object} element
 */
export function addStatePathBinding(element) {
  const properties = element.constructor.properties;
  // TODO: Remove side effects
  return Object.keys(properties).reduce( (disposers, property) => {
    const { [property]: { statePath } } = properties;

    // If property has statePath field with a proper store
    // -> subscribe to state mutations
    if (statePath && appState.hasOwnProperty(statePath.store)) {
      const disposer = autorun(() => {
        const appStateValue = deepPathCheck(statePath.store, statePath.path);

        // Update property with mutated state value
        element.set(property, toJS(appStateValue));
      });

      disposers.push(disposer);
    }
    return disposers;
  }, []);
}

/**
 * Adds state observers specified in a component
 *
 * @memberof Epoxy
 * @param {Object} element
 */
export function addStateObservers(element) {
  const stateObservers = element.stateObservers;

  return stateObservers.reduce((disposers, {store: storeName, observer, path}) => {
    let disposer;

    if (path) {
      disposer = autorun(() => {
        const appStateValue = deepPathCheck(storeName, path);

        observer.call(element, appStateValue);
      });
    } else {
      disposer = autorun(observer.bind(element, appState[storeName].model));
    }

    disposers.push(disposer);

    return disposers;
  }, []);

}

/**
 * Create an app state with the provided stores
 *
 * @memberof Epoxy
 * @param  {Object} stores
 * @return {Object}       app state
 */
export function combineStores(stores) {
  return Object.keys(stores).reduce( (state, key) => {
    // mobx.observable() applies itself recursively by default,
    // so all fields inside the model are observable
    const model = observable(stores[key].model);
    const actions = actionsReducer(stores[key].actions);
    
    if(!state[key]) {

      state[key] = {
        ...actions,
        getStore: getStore.bind(this, state),
        extendObservable,
        //action,
        model
      };

    }

    return state;
  }, appState);
}

/**
 * Dispach an action to a defined store
 *
 * @memberof Epoxy
 * @param  {string} store   Store name
 * @param  {string} action  Action name
 * @param  {any} payload Payload data. Optional
 * @return {Object}         Store object
 */
export function dispatch(middlewares, actionObject) {
  const {store, action, payload} = actionObject;

  if (middlewares) {
    applyMiddlewares.apply(this, arguments);
  }

  if (appState[store] && appState[store].actions && appState[store].actions[action]) {
    const storeAction = appState[store].actions[action];

    return storeAction.apply(appState[store], [payload]);
  }

  console.warn(`No action "${action}" for "${store}" store`);
}

/**
 * Get a deep property value from a store
 *
 * @memberof Epoxy
 * @param  {string} storeName
 * @param  {string} path  Example: path.subpath.subsubpath
 * @return {any}
 */
export function deepPathCheck(storeName, path) {
  const pathArray = path.split('.');
  const { [storeName]: { model } } = appState;

  return pathArray.reduce((prev, next) => {
    const hasNextPath = prev && prev.hasOwnProperty && prev.hasOwnProperty(next);

    if (hasNextPath) {
      return prev[next];
    }
  }, model);
}
