/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { user } from "@web/core/user";
import { patch } from "@web/core/utils/patch";
import { menuService } from "@web/webclient/menus/menu_service";

export function normalizeId(value) {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : false;
}

function storageKey(actionId) {
    return `oy_search_field_labels.menu.${user.userId}.${actionId}`;
}

export function getLabelLocation(env, config) {
    const actionId = normalizeId(env.config?.actionId);
    if (!actionId) {
        return { actionId: false, menuId: false };
    }
    const context = config.context || {};
    let menuId = false;
    if (context.oy_search_field_labels_action_id === actionId) {
        menuId = normalizeId(context.oy_search_field_labels_menu_id);
    } else if (config.state?.searchFieldLabelLocation?.actionId === actionId) {
        menuId = normalizeId(config.state.searchFieldLabelLocation.menuId);
    } else if (context.params?.action) {
        // Route reloads discard additionalContext. Restore only on that route,
        // not on unrelated direct doAction calls or embedded relation dialogs.
        const savedId = Number(browser.sessionStorage.getItem(storageKey(actionId)));
        const savedMenu = env.services.menu?.getMenu(savedId);
        if (savedMenu?.actionID === actionId) {
            menuId = normalizeId(savedId);
        }
    }
    return { actionId, menuId };
}

patch(menuService, {
    async start(env) {
        const menus = await super.start(...arguments);
        env.bus.addEventListener("ACTION_MANAGER:UI-UPDATED", (event) => {
            if (event.detail === "new") {
                return;
            }
            const controller = env.services.action.currentController;
            const actionId = normalizeId(controller?.action?.id);
            const state = controller?.getGlobalState?.()?.searchModel;
            if (!actionId || !state) {
                return;
            }
            const location = JSON.parse(state).searchFieldLabelLocation;
            if (location?.actionId !== actionId) {
                return;
            }
            // Save only the scope of the window that actually finished mounting.
            // In particular, a direct action must clear the preceding menu scope
            // so a later route reload does not bring that menu's labels back.
            const menuId = normalizeId(location.menuId);
            if (menuId) {
                browser.sessionStorage.setItem(storageKey(actionId), String(menuId));
            } else {
                browser.sessionStorage.removeItem(storageKey(actionId));
            }
        });
        // Odoo keeps only the current app, so carry the exact leaf menu in the
        // action context. Two menus opening the same action remain distinct.
        menus.selectMenu = async function (menu) {
            menu = typeof menu === "number" ? menus.getMenu(menu) : menu;
            if (!menu?.actionID) {
                return;
            }
            return env.services.action.doAction(menu.actionID, {
                clearBreadcrumbs: true,
                additionalContext: {
                    oy_search_field_labels_menu_id: menu.id,
                    oy_search_field_labels_action_id: menu.actionID,
                },
                onActionReady: () => {
                    menus.setCurrentMenu(menu);
                    browser.sessionStorage.setItem(storageKey(menu.actionID), String(menu.id));
                },
            });
        };
        return menus;
    },
});
