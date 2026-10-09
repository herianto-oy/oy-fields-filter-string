/** @odoo-module **/

import { makeContext } from "@web/core/context";
import { user } from "@web/core/user";
import { patch } from "@web/core/utils/patch";
import { menuService } from "@web/webclient/menus/menu_service";

export function normalizeId(value) {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : false;
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
    }
    return { actionId, menuId };
}

patch(menuService, {
    async start(env) {
        const menus = await super.start(...arguments);
        // Odoo keeps only the current app, so carry the exact leaf menu in the
        // action context. Two menus opening the same action remain distinct.
        menus.selectMenu = async function (menu) {
            menu = typeof menu === "number" ? menus.getMenu(menu) : menu;
            if (!menu?.actionID) {
                return;
            }
            const labelContext = {
                oy_search_field_labels_menu_id: menu.id,
                oy_search_field_labels_action_id: menu.actionID,
            };
            return env.services.action.doAction(menu.actionID, {
                clearBreadcrumbs: true,
                additionalContext: labelContext,
                onActionReady: (action) => {
                    // Odoo persists _originalAction for real route reloads.
                    // Preserve this menu's context before the controller mounts.
                    if (action._originalAction) {
                        const original = JSON.parse(action._originalAction);
                        original.context = makeContext([labelContext, original.context], user.context);
                        action._originalAction = JSON.stringify(original);
                    }
                    menus.setCurrentMenu(menu);
                },
            });
        };
        return menus;
    },
});
