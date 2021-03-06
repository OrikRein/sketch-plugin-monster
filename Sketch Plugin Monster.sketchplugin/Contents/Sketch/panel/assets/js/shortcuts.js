var globalNotice = new Notification();
var shortcutsHandler;
var i18n;

/**
 * render plugin list into page
 * @param  {Object} source source data
 */
function renderList(source) {
  var listRender = new TemplateEngine('shortcuts-template');
  var wrapper = document.createElement('div');
  var commands = {};
  var inputs;

  wrapper.id = 'panel-wrapper';
  wrapper.innerHTML = listRender({ plugins: shortcutsHandler.getCommandList(), i18n: i18n });

  // check and display conflicting shortcut key
  inputs = wrapper.getElementsByTagName('input');

  Array.prototype.forEach.call(inputs, function (input) {
    if (input.value) {
      commands[input.value] = typeof(commands[input.value]) === 'number' ?
                              (commands[input.value] + 1) :
                              0;
    }
  });

  Array.prototype.forEach.call(inputs, function (input) {
    var commandWrapper = input.parentNode.parentNode;
    var pluginWrapper = commandWrapper.parentNode.parentNode.parentNode;

    if (commands[input.value]) {
       commandWrapper.classList.add('shortcut-conflict');
       pluginWrapper.classList.add('shortcut-conflict');
       pluginWrapper.classList.remove('collapse');
    }
  });

  // wait for DOM updated
  setTimeout(function () {
    renderConflictMsg();

    // support collapse
    Array.prototype.forEach.call(document.querySelectorAll('.plugin-shortcuts-panel h2'), function (item) {
      var parentPlugin = item.parentNode.cloneNode(true);

      parentPlugin.classList.remove('collapse');
      parentPlugin.style.visibility = 'hidden';
      document.body.appendChild(parentPlugin);
      item.parentNode.style.maxHeight = (parseInt(getComputedStyle(parentPlugin).height) || 0) + 'px';
      parentPlugin.remove();

      item.addEventListener('click', function () {
        this.parentNode.classList.toggle('collapse');
      });
    });
  }, 0);


  // handle shortcut change
  wrapper.addEventListener('keydown', function (ev) {
    if (ev.target.tagName === 'INPUT' && ev.keyCode) {
      var targetKey = source.keyCodes[ev.keyCode];
      var shortcut  = targetKey ? [targetKey] : [];
      var shortcutStr;
      var conflictResult;
      var replacement;

      if (shortcut.length) {
        // handle special keys
        if (ev.metaKey) shortcut.unshift('cmd');
        if (ev.shiftKey) shortcut.unshift('shift');
        if (ev.altKey) shortcut.unshift('option');
        if (ev.ctrlKey) shortcut.unshift('ctrl');

        shortcutStr = shortcut.join(' ');
        conflictResult = shortcutsHandler.checkConflict(shortcutStr);

        if (conflictResult) {
          if (conflictResult.shortcutName !== ev.target.getAttribute('data-command')) {
            // prompt user if this shortcut conflict with Sketch or other plugin
            globalNotice.error(source.i18n.conflict
                                          .replace('${ shortcutName }', conflictResult.shortcutName)
                                          .replace('${ conflictTarget }', conflictResult.name)
                               , 2000);
          } else {
            ev.target.blur();
          }
        } else {
          replacement = {
            plugin: ev.target.getAttribute('data-plugin'),
            identifier: ev.target.getAttribute('data-identifier'),
            shortcut: shortcut.join(' ')
          };

          // update shortcut and review conflict for input
          reviewConflict(ev.target, convertShortcut(shortcutStr));

          // update shortcut
          shortcutsHandler.setShortcutForPlugin(replacement);

          globalNotice.success(source.i18n.success, 1500);
          ev.target.blur();
        }
      } else if (ev.keyCode === 27) {
        ev.target.blur();
      } else if ([16, 17, 18, 91, 93].indexOf(ev.keyCode) === -1) {
        // except shift, control, option, command keys
        globalNotice.error(source.i18n.notSupport, 1500);
      }

      ev.preventDefault();
    }
  });

  // handle clear action
  wrapper.addEventListener('click', function (ev) {
    if (ev.target.tagName === 'BUTTON') {
      shortcutsHandler.clearShortcutForPlugin({
        plugin: ev.target.getAttribute('data-plugin'),
        identifier: ev.target.getAttribute('data-identifier')
      });

      // clear shortcut and review conflict for input
      reviewConflict(ev.target.previousSibling, '');

      globalNotice.success(source.i18n.clear, 1500);
    }
  });

  document.body.appendChild(wrapper);
}

/**
 * set i18n with i18n configurations
 */
function setI18n(i18n) {
  document.querySelector('.page-title').innerHTML = i18n.title;
  document.querySelector('.usage-desc').innerHTML = i18n.usage;
  document.querySelector('.btn-filter-reset').innerHTML = i18n.clearFilter;
}

/**
 * convert shortcut to symbols
 * @param  {String} str original shortcut
 * @return {String}     shortcut
 */
function convertShortcut(str) {
  var keys = (str || '').split(' ');
  var mapping = {
    'cmd': '\u2318',
    'command': '\u2318',
    'ctrl': '\u2303',
    'control': '\u2303',
    'alt': '\u2325',
    'option': '\u2325',
    'shift': '\u21E7',
  };

  return keys.map(function (key) {
    return mapping[key] || key;
  }).join('');
}

/**
 * review conflict and update shortcut for input
 * @param  {DOM}    targetInput the input which will update
 * @param  {String} newShortcut updating shortcut
 */
function reviewConflict (targetInput, newShortcut) {
  var inputs;
  var queryStr;
  var plugins = document.querySelectorAll('.plugin-shortcuts-panel.shortcut-conflict');
  var parentRow = targetInput.parentNode.parentNode;

  if (parentRow.classList.contains('shortcut-conflict')) {
    queryStr = '.plugin-shortcuts-panel input[value=' + targetInput.value + ']';
    targetInput.setAttribute('value', newShortcut); // prevent querySelectorAll get error result
    inputs = document.querySelectorAll(queryStr);
    parentRow.classList.remove('shortcut-conflict');

    if (inputs.length === 1) {
      inputs[0].parentNode.parentNode.classList.remove('shortcut-conflict');
    }

    Array.prototype.forEach.call(plugins, function (plugin) {
      if (!plugin.querySelectorAll('.shortcut-conflict').length) {
        plugin.classList.remove('shortcut-conflict');
      }
    });

    renderConflictMsg();
  } else {
    targetInput.value = newShortcut;
  }
}

/**
 * render conflict message in header
 */
function renderConflictMsg() {
  var conflictCommands = document.querySelectorAll('.plugin-shortcuts-panel .shortcut-conflict input');
  var conflictCount = conflictCommands.length;
  var container = document.querySelector('.conflict-warning');
  var conflictDetails = document.querySelector('.conflict-details');

  if (conflictCount) {
    container.innerHTML = i18n.conflictWarning.replace('${ conflictCount }', conflictCount);
    container.setAttribute('data-count', conflictCount > 99 ? '99+' : conflictCount);
    conflictDetails.innerHTML = Array.prototype.map.call(Array.prototype.reduce.call(conflictCommands, function (r, input, index) {
      if (r[input.value]) {
        r[input.value] ++;
      } else {
        r[input.value] = 1;
        r[index] = input.value;
        r.length ? r.length ++ : (r.length = 1);
      }

      return r;
    }, {}), function (item, i, arr) {
      return ['<li onclick="filterPluginList(\'', item ,'\')"><kbd>', item, '</kbd><span>x', arr[item], '</span></li>'].join('');
    }).join('');
  } else {
    conflictDetails.innerHTML = '';
    container.innerHTML = '';
    filterPluginList();
  }

}

/**
 * filter plugin list and command list
 * @param  {String|undefined} shortcut shorcut name; exit filter status
 */
function filterPluginList(shortcut) {
  // clear current filter targets
  Array.prototype.forEach.call(document.querySelectorAll('#panel-wrapper .filter-target'), function (item) {
    item.classList.remove('filter-target');
  });
  if (shortcut) {
    // find filter targets
    Array.prototype.forEach.call(document.querySelectorAll('.plugin-shortcuts-panel input'), function (input) {
      var row = input.parentNode.parentNode;
      if (input.value === shortcut) {
        row.classList.add('filter-target');
        row.parentNode.parentNode.parentNode.classList.add('filter-target'); // plugin
      }
    });
    document.body.classList.add('filtered');
  } else {
    document.body.classList.remove('filtered');
  }
}

/**
 * initialize overlay menus
 */
function initOverlayMenus() {
  var menus = document.querySelectorAll('.fixed-overlay-menu');

  Array.prototype.forEach.call(menus, function (menu) {
    document.querySelector(menu.getAttribute('data-toggle')).addEventListener('click', function (ev) {
      var target = document.querySelector('.fixed-overlay-menu.show');
      target && target !== menu && target.classList.remove('show');
      menu.classList.toggle('show');
      ev.stopPropagation();
    });
  });

  document.addEventListener('click', function (ev) {
    var target = document.querySelector('.fixed-overlay-menu.show');
    target && target.classList.remove('show');
  });
}

/**
 * initialize settings menu
 * @param  {Object} commands commands from i18n
 */
function initSettingsMenu(commands) {
  var presets = ['checkForUpdates', 'linkFeedback'];
  var settingsMenu = document.querySelector('.fixed-overlay-menu[data-toggle=".btn-settings"]');
  var result = '';

  Object.keys(commands).forEach(function (i) {
    if (presets.indexOf(i) > -1) {
      result += ['<li onclick="$dispatch(\'$pluginMonster:', i, '\')">', commands[i], '</li>'].join('');
    }
  });

  result += '<li class="disabled">v0.2.0</li>'

  settingsMenu.innerHTML = result;
}

/**
 * $initialize by CocoaScript
 * @param  {Object} source source data from CocoaScript
 */
function $initialize(source) {
  shortcutsHandler = new ShortcutsHandler(source.shortcuts, source.sketchShortcuts);
  i18n = source.i18n;
  renderList(source);
  setI18n(source.i18n);
  initOverlayMenus();
  initSettingsMenu(source.i18nCommands);
}
