import { useStrict, toJS } from 'mobx';
import { combineStores, addStatePathBinding, addStateObservers, deepPathCheck, dispatch } from './epoxy';
import createBehavior from './behavior';
import createMixin from './mixin';

const epoxy = {
  useStrict: useStrict,
  createBehavior,
  createMixin
};

// Enable strict mode by default
// it allows store changes only throught actions
epoxy.useStrict(true);

export default epoxy;

