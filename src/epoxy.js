/*eslint no-console: ["error", { allow: ["warn", "error"] }] */

import { useStrict, isStrictModeEnabled, autorun, observable, extendObservable, action, toJS } from 'mobx';

export { toJS, useStrict, isStrictModeEnabled };

// Force strict mode (for now)
useStrict(true);

const store = {};

function addHiddenFinalProp(object, propName, value) {
  Object.defineProperty(object, propName, {
    enumerable: false,
    writable: false,
    configurable: true,
    value: value
  });
}

function decorateState(state) {
  addHiddenFinalProp(state, 'getState', getState);
  addHiddenFinalProp(state, 'extendObservable', extendObservable);
}

/**
 * Create a mobx actions object
 * @param  {Object} actions Raw actions functions
 * @return {Object}         Mobx actions
 */
function actionsReducer(actions) {
  return Object.keys(actions).reduce((prevActions, actionName) => {
    prevActions[actionName] = action.bound(actions[actionName]);

    return prevActions;
  }, {});
}

function applyMiddlewares(middlewares, actionObject) {
  middlewares.forEach(middleware => {
    middleware(store, actionObject);
  });
}

/**
 * Iterates through a polymer element properties to find statePath atribute
 * subscribing it to state mutations
 *
 * @memberof Epoxy
 * @param {Object} store
 * @param {Object} element
 */
export function getState(stateName) {
  const model = store[stateName];

  return toJS(model);
}

function applyValueToElement(element, property, value) {
  const properties = element.constructor.properties;

  // Update property with mutated state value
  if (properties[property].readOnly) {
    element[`_set${property[0].toUpperCase() + property.slice(1)}`](toJS(value));
  } else {
    // TODO Override default Polymer setter behavior on non strict scenarios for bidirectional updates
    element.set(property, toJS(value));
  }
}

/**
 * Iterates through a polymer element properties to find statePath atribute
 * subscribing it to state mutations
 *
 * @memberof Epoxy
 * @param {Object} store
 * @param {Object} element
 */
export function addStatePathBinding(element) {
  
  const properties = element.constructor.properties;

  // TODO: Remove side effects
  return Object.keys(properties).reduce((disposers, property) => {
    const {
      [property]: {
        statePath
      }
    } = properties;

    // If property has statePath field with a proper store
    // -> subscribe to state mutations
    if (statePath && store.hasOwnProperty(statePath.store)) {
      const disposer = autorun(() => {
        const value = deepPathCheck(statePath.store, statePath.path);
        applyValueToElement(element, property, value);
      });

      disposers.push(disposer);
    }
    return disposers;
  }, []);
}

/**
 * Connects a Polymer component to a MobX store.
 * It does not modify the component class passed to it; instead, it returns a new, connected component class for you to use.
 *
 * @memberof Epoxy
 * @param {Function} mapStateToProps
 * @param {Function} mapDispatchToProps
 */
export function addConnectedStateBinding(element, mapStateToProps) {

  const disposer = autorun(() => {
    const storeValues = mapStateToProps(store);
    Object.keys(storeValues).map((property) => {
      applyValueToElement(element, property, storeValues[property]);
    });
  });

  return [disposer];
  
}

/**
 * Adds state observers specified in a component
 *
 * @memberof Epoxy
 * @param {Object} element
 */
export function addStateObservers(element) {
  const stateObservers = element.stateObservers;

  return stateObservers.reduce((disposers, { store: storeName, observer, path }) => {
    let disposer;

    if (path) {
      disposer = autorun(() => {
        const storeValue = deepPathCheck(storeName, path);

        observer.call(element, storeValue);
      });
    } else {
      disposer = autorun(observer.bind(element, store[storeName].model));
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

  return Object.keys(models).reduce((store, key) => {

    const model = Object.getOwnPropertyNames(models[key]).reduce((cleanObj, cleanKey) => {
      const property = Object.getOwnPropertyDescriptor(models[key], cleanKey);
      if (!property.value || (property.value && typeof(property.value) !== 'function')) {
        Object.defineProperty(cleanObj, cleanKey, property);
      } else {
        if (!actions[cleanKey]) {
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

    if (!store[key]) {
      store[key] = state;
    }
    console.log(store);
    return store[key];
  }, store);
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
  const { store, action, payload } = actionObject;

  if (middlewares) {
    applyMiddlewares.apply(this, arguments);
  }

  if (store[store] && store[store][action]) {
    const storeAction = store[store][action];

    return storeAction.apply(store[store], [payload]);
  }

  console.warn(`No action "${action}" for "${store}" store`);
}

/**
 * Get a deep property value from a store
 *
 * @memberof Epoxy
 * @param  {string} stateName
 * @param  {string} path  Example: path.subpath.subsubpath
 * @return {any}
 */
export function deepPathCheck(stateName, path) {
  const pathArray = path.split('.');

  return pathArray.reduce((prev, next) => {
    const hasNextPath = prev && prev.hasOwnProperty && prev.hasOwnProperty(next);

    if (hasNextPath) {
      return prev[next];
    }
  }, store[stateName]);
}

