import Emitter from './emitter';
import Parchment from 'parchment';
import extend from '../lib/extend';

let debug = logger('quill');


class Quill {

    /**
     * 主要的构造器
     * @param  {[type]} container [description]
     * @param  {Object} options   [description]
     * @return {[type]}           [description]
     */
    constructor(container, options = {}) {
        this.options = expandConfig(container, options);
        this.container = this.options.container;
        if (this.container == null) {
            return debug.error('Invalid Quill container', container);
        }
        let html = this.container.innerHTML.trim();
        this.container.classList.add('ql-container');
        this.container.innerHTML = '';
        this.container.__quill = this;
        this.root = this.addContainer('ql-editor');
        this.root.classList.add('ql-blank');
        this.scrollingContainer = this.root;
        this.emitter = new Emitter();
        this.scroll = Parchment.create(this.root, {
            emitter: this.emitter,
            scrollingContainer: this.scrollingContainer,
            whitelist: this.options.formats
        });
        this.editor = new Editor(this.scroll);
        this.selection = new Selection(this.scroll, this.emitter);
        this.theme = new this.options.theme(this, this.options);
        this.keyboard = this.theme.addModule('keyboard');
        this.clipboard = this.theme.addModule('clipboard');
        this.history = this.theme.addModule('history');
        this.theme.init();
        this.emitter.on(Emitter.events.EDITOR_CHANGE, (type) => {
            if (type === Emitter.events.TEXT_CHANGE) {
                this.root.classList.toggle('ql-blank', this.editor.isBlank());
            }
        });
        this.emitter.on(Emitter.events.SCROLL_UPDATE, (source, mutations) => {
            let range = this.selection.lastRange;
            let index = range && range.length === 0 ? range.index : undefined;
            modify.call(this, () => {
                return this.editor.update(null, mutations, index);
            }, source);
        });
        let contents = this.clipboard.convert(`<div class='ql-editor' style="white-space: normal;">${html}<p><br></p></div>`);
        this.setContents(contents);
        this.history.clear();
        if (this.options.placeholder) {
            this.root.setAttribute('data-placeholder', this.options.placeholder);
        }
        if (this.options.readOnly) {
            this.disable();
        }
    }

    addContainer(container, refNode = null) {
        if (typeof container === 'string') {
            let className = container;
            container = document.createElement('div');
            container.classList.add(className);
        }
        this.container.insertBefore(container, refNode);
        return container;
    }

    setContents(delta, source = Emitter.sources.API) {
        return modify.call(this, () => {
            delta = new Delta(delta);
            let length = this.getLength();
            let deleted = this.editor.deleteText(0, length);
            let applied = this.editor.applyDelta(delta);
            let lastOp = applied.ops[applied.ops.length - 1];
            if (lastOp != null && typeof(lastOp.insert) === 'string' && lastOp.insert[lastOp.insert.length - 1] === '\n') {
                this.editor.deleteText(this.getLength() - 1, 1);
                applied.delete(1);
            }
            let ret = deleted.compose(applied);
            return ret;
        }, source);
    }

    /**
     * 切换当前为不可用
     * @return {undefined} 无
     */
    disable() {
        this.enable(false);
    }
    /**
     * 切换当前可用状态
     * @param  {Boolean} enabled    切换可用为true 不可用为false
     * @return {undefined}          无
     */
    enable(enabled = true) {
        this.scroll.enable(enabled);
        this.container.classList.toggle('ql-disabled', !enabled);
    }
}
Quill.DEFAULTS = {
    bounds: null,
    formats: null,
    modules: {},
    placeholder: '',
    readOnly: false,
    scrollingContainer: null,
    strict: true,
    theme: 'default'
};
Quill.events = Emitter.events;
Quill.sources = Emitter.sources;

Quill.version = '0.0.1';

Quill.imports = {
    'delta': Delta,
    'parchment': Parchment,
    'core/module': Module,
    'core/theme': Theme
};


/**
 * 扩展Config
 * @param  {String} container  container的选择器
 * @param  {Object} userConfig 扩展的Config对象
 * @return {Object}            扩展后的Config
 */
function expandConfig(container, userConfig) {
    userConfig = extend(true, {
        container: container,
        modules: {
            clipboard: true,
            keyboard: true,
            history: true
        }
    }, userConfig);
    if (!userConfig.theme || userConfig.theme === Quill.DEFAULTS.theme) {
        userConfig.theme = Theme;
    } else {
        userConfig.theme = Quill.import(`themes/${userConfig.theme}`);
        if (userConfig.theme == null) {
            throw new Error(`Invalid theme ${userConfig.theme}. Did you register it?`);
        }
    }
    let themeConfig = extend(true, {}, userConfig.theme.DEFAULTS);
    [themeConfig, userConfig].forEach(function(config) {
        config.modules = config.modules || {};
        Object.keys(config.modules).forEach(function(module) {
            if (config.modules[module] === true) {
                config.modules[module] = {};
            }
        });
    });
    let moduleNames = Object.keys(themeConfig.modules).concat(Object.keys(userConfig.modules));
    let moduleConfig = moduleNames.reduce(function(config, name) {
        let moduleClass = Quill.import(`modules/${name}`);
        if (moduleClass == null) {
            debug.error(`Cannot load ${name} module. Are you sure you registered it?`);
        } else {
            config[name] = moduleClass.DEFAULTS || {};
        }
        return config;
    }, {});
    // Special case toolbar shorthand
    if (userConfig.modules != null && userConfig.modules.toolbar &&
        userConfig.modules.toolbar.constructor !== Object) {
        userConfig.modules.toolbar = {
            container: userConfig.modules.toolbar
        };
    }
    userConfig = extend(true, {}, Quill.DEFAULTS, { modules: moduleConfig }, themeConfig, userConfig);
    ['bounds', 'container', 'scrollingContainer'].forEach(function(key) {
        if (typeof userConfig[key] === 'string') {
            userConfig[key] = document.querySelector(userConfig[key]);
        }
    });
    userConfig.modules = Object.keys(userConfig.modules).reduce(function(config, name) {
        if (userConfig.modules[name]) {
            config[name] = userConfig.modules[name];
        }
        return config;
    }, {});
    return userConfig;
}
