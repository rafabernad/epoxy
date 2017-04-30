import { toJS } from 'mobx';
import { combineStores, addStatePathBinding, addStateObservers, deepPathCheck, dispatch } from './epoxy';

export default function(stores, middlewares) {

  // Combine the provided stores with the app state
  combineStores(stores);

  return (superclass) => class extends superclass {  
  
    created() {
      this._disposers = !this._disposers && [];
      this.dispatch = dispatch.bind(this, middlewares);
      super.created.apply(this, arguments);
    }

    attached() {
      if (this.properties) {
        const stateBindingsDisposers = addStatePathBinding(this);
        this._disposers = this._disposers.concat(stateBindingsDisposers);
      }

      if (this.stateObservers) {
        const stateObserversDisposers = addStateObservers(this);
        this._disposers = this._disposers.concat(stateObserversDisposers);
      }
      super.attached.apply(this, arguments);
    }

    detached() {
      this._disposers.forEach(disposer => disposer());
      super.detached.apply(this, arguments);
    }

    /**
     * Gets a field/property of the selected store
     * @param  {string} store
     * @param  {string} path
     * @return {any}  field/property value
     */
    getStateProperty(store, path) {
      const stateProperty = deepPathCheck(store, path);

      return toJS(stateProperty);
    }
  }
}
