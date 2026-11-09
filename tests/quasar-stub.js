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
  setup(props, { slots }) {
    const nodes = props.nodes || [];
    return () =>
      h(
        'div',
        { class: 'q-tree-stub' },
        nodes.length === 0
          ? h('div', { class: 'q-tree__no-nodes' }, props.noNodesLabel || 'No nodes')
          : nodes.map((node) =>
              h(
                'div',
                { class: 'q-tree__node' },
                slots['default-header'] ? slots['default-header']({ node }) : null,
              ),
            ),
      );
  },
};

// Stand-in for the runtime-provided `entity-name` component (Asset Link registers
// it globally, so in tests it arrives as the string tag 'entity-name'). Renders
// something stable so tests can assert that log nodes actually rendered.
export const EntityName = {
  name: 'entity-name',
  props: ['entity'],
  setup(props) {
    return () =>
      h(
        'span',
        { class: 'entity-name-stub' },
        props.entity?.attributes?.name || props.entity?.id || props.entity?.type || 'entity',
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
