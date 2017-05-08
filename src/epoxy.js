/*eslint no-console: ["error", { allow: ["warn", "error"] }] */

import { useStrict, isStrictModeEnabled, autorun, observable, extendObservable, action, toJS } from 'mobx';

export { toJS, useStrict, isStrictModeEnabled };

// Force strict mode (for now)
useStrict(true);

const appState = {};

function addHiddenFinalProp(object, propName, value) {
    Object.defineProperty(object, propName, {
        enumerable: false,
        writable: false,
        configurable: true,
        value: value
    });
}

function decorateState(state) {
    addHiddenFinalProp(state, 'getStore', getStore);
    addHiddenFinalProp(state, 'extendObservable', extendObservable);
}

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
export function getStore(storeName) {
  const model = appState[storeName];

  return toJS(model);
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
        if(properties[property].readOnly) {
          element[`_set${property[0].toUpperCase() + property.slice(1)}`](toJS(appStateValue))
        } else {
          // TODO Override default Polymer setter for non strict scenarios for bidirectional updates
          element.set([property, toJS(appStateValue)]);
        }
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
 * Create an app store with the provided state and actions
 *
 * @memberof Epoxy
 * @param  {Object} stores
 * @return {Object}       app state
 */
export function combineStores(models, actions = {}) {

  return Object.keys(models).reduce( (appState, key) => {

    const model = Object.getOwnPropertyNames(models[key]).reduce((cleanObj, cleanKey) => {
      const property = Object.getOwnPropertyDescriptor(models[key], cleanKey);
      if(!property.value || (property.value && typeof(property.value) !== 'function')) {
        Object.defineProperty(cleanObj, cleanKey, property);
      } else {
        if(!actions[cleanKey]) {
          Object.defineProperty(actions, cleanKey, property)
        }
      }
      return cleanObj;
    }, new Object());
    // mobx.observable() applies itself recursively by default,
    // so all fields inside the model are observable
    const state = observable(model);
    const reducers = actionsReducer(actions);

    extendObservable(state, reducers);
    decorateState(state);

    if(!appState[key]) {
      appState[key] = state;
    }
    
    return appState;
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

  if (appState[store] && appState[store][action]) {
    const storeAction = appState[store][action];

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

  return pathArray.reduce((prev, next) => {
    const hasNextPath = prev && prev.hasOwnProperty && prev.hasOwnProperty(next);

    if (hasNextPath) {
      return prev[next];
    }
  }, appState[storeName]);
}
