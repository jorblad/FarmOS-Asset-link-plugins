import { h } from 'vue';

// Minimal stand-ins for the Quasar bits the plugins import. They let the shared
// components/helpers be imported and unit-tested under Vitest without pulling in
// the full Quasar build. Notify records its calls so tests can assert on toasts.

export const Notify = {
  _calls: [],
  create(opts) {
    this._calls.push(opts);
    return { dismiss: () => {} };
  },
  reset() {
    this._calls = [];
  },
};

// Stand-in for the Dialog plugin (the only Quasar plugin Asset Link actually
// registers). `notify()` falls back to Dialog.create when Notify is unavailable.
export const Dialog = {
  _calls: [],
  create(opts) {
    this._calls.push(opts);
    return { dismiss: () => {}, update: () => {} };
  },
  reset() {
    this._calls = [];
  },
};

export const QTree = {
  name: 'QTree',
  props: ['nodes', 'nodeKey', 'selected', 'noNodesLabel', 'class'],
  setup(_, { slots }) {
    return () =>
      h(
        'div',
        { class: 'q-tree-stub' },
        slots.default ? slots.default({ node: { log: {} }, label: '' }) : null,
      );
  },
};

export const QBtn = {
  name: 'QBtn',
  props: ['label', 'color', 'onClick', 'block', 'noCaps', 'disabled'],
  setup(props, { slots }) {
    return () =>
      h(
        'button',
        { class: 'q-btn-stub', onClick: props.onClick },
        slots.default ? slots.default() : props.label,
      );
  },
};
