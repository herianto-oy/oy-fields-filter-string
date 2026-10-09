/** @odoo-module **/

import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import { normalizeId } from "./menu_scope";

// Work on copies: the shared field service also serves forms, exports and imports.
export function applyLabels(fieldDefs, labels, usage) {
    return Object.fromEntries(
        Object.entries(fieldDefs).map(([name, field]) => [
            name,
            labels[name]?.[usage] && !field.is_property
                ? { ...field, string: labels[name][usage] }
                : field,
        ])
    );
}

export function makeFilterFieldService(field, loadLabels) {
    async function decorate(resModel, fieldDefs) {
        if (!resModel || resModel === "*") {
            return fieldDefs;
        }
        return applyLabels(fieldDefs, await loadLabels(resModel), "filter_label");
    }
    const adapter = {
        ...field,
        async loadFields(resModel, options) {
            return decorate(resModel, await field.loadFields(resModel, options));
        },
        async loadPath(resModel, path, followRelationalProperties = false) {
            const result = await field.loadPath(resModel, path, followRelationalProperties);
            return {
                ...result,
                modelsInfo: await Promise.all(
                    result.modelsInfo.map(async (info) => ({
                        ...info,
                        fieldDefs: await decorate(info.resModel, info.fieldDefs),
                    }))
                ),
            };
        },
        async loadFieldInfo(resModel, path) {
            const result = await field.loadFieldInfo(resModel, path);
            if (!result.fieldDef || result.fieldDef.is_property) {
                return result;
            }
            const name = path.split(".").at(-1);
            const definitions = await decorate(result.resModel, { [name]: result.fieldDef });
            return { ...result, fieldDef: definitions[name] };
        },
        async loadPathDescription(resModel, path, allowEmpty) {
            const result = await field.loadPathDescription(resModel, path, allowEmpty);
            if (typeof path !== "string" || !path || path === "*") {
                return result;
            }
            // Core closes over its own loadPath. Decorate descriptions explicitly
            // so selected paths, filter facets and tooltips use the scoped labels.
            const { modelsInfo, names } = await adapter.loadPath(resModel, path);
            return {
                ...result,
                displayNames: result.displayNames.map((name, index) =>
                    modelsInfo[index]?.fieldDefs[names[index]]?.string || name
                ),
            };
        },
    };
    return adapter;
}

export const searchFieldLabelsService = {
    dependencies: ["orm", "field"],
    start(env, { orm, field }) {
        const cache = new Map();
        function load(resModel, location = {}) {
            const actionId = normalizeId(location.actionId);
            const menuId = actionId && normalizeId(location.menuId);
            const key = JSON.stringify([resModel, actionId, menuId, user.userId, user.context.lang]);
            if (!cache.has(key)) {
                const request = orm.call("search.field.label", "get_labels", [resModel, actionId, menuId]);
                cache.set(key, request);
                request.catch(() => {
                    if (cache.get(key) === request) {
                        cache.delete(key);
                    }
                });
            }
            return cache.get(key);
        }
        env.bus.addEventListener("CLEAR-CACHES", () => cache.clear());
        return {
            load,
            forLocation(location = {}) {
                const snapshot = { ...location };
                return makeFilterFieldService(field, (model) => load(model, snapshot));
            },
        };
    },
};

registry.category("services").add("search_field_labels", searchFieldLabelsService);
