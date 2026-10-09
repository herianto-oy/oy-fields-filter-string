/** @odoo-module **/

import { beforeEach, describe, expect, test } from "@odoo/hoot";
import { animationFrame } from "@odoo/hoot-mock";
import { SearchBar } from "@web/search/search_bar/search_bar";
import { DomainSelectorDialog } from "@web/core/domain_selector_dialog/domain_selector_dialog";
import { WebClient } from "@web/webclient/webclient";
import {
    contains, defineActions, defineMenus, defineModels, fields, getFacetTexts, getService, models,
    mountWithCleanup, mountWithSearch, onRpc, openAddCustomFilterDialog, toggleSearchBarMenu, webModels,
} from "@web/../tests/web_test_helpers";
import {
    getCurrentPath, getDisplayedFieldNames, openModelFieldSelectorPopover,
} from "@web/../tests/core/tree_editor/condition_tree_editor_test_helpers";
import { makeFilterFieldService, searchFieldLabelsService } from "@oy_search_field_labels/label_service";
import { getLabelLocation } from "@oy_search_field_labels/menu_scope";
import "@oy_search_field_labels/search_labels";

describe.current.tags("oy_search_field_labels");

class Contact extends models.Model {
    _name = "label.contact";
    name = fields.Char({ string: "Contact Name" });
    city = fields.Char({ string: "City" });
    manager_id = fields.Many2one({ relation: "label.contact", string: "Manager" });
    birthday = fields.Date({ string: "Birthday" });
    _records = [{ id: 1, name: "Ada", city: "Jakarta", birthday: "2000-01-01" }];
    _views = {
        list: '<list><field name="name"/><field name="city"/></list>',
        search: '<search><field name="name"/></search>',
        form: '<form><field name="name"/></form>',
    };
}
defineModels([Contact]);

const labels = {
    name: { filter_label: "Filter Contact", group_by_label: "Contact Group" },
    birthday: { filter_label: "", group_by_label: "Birth Period" },
};

let labelResolver;
beforeEach(() => {
    labelResolver = () => labels;
    onRpc("search.field.label", "get_labels", (params) => labelResolver(params));
    onRpc("/web/domain/validate", () => true);
});

async function mountSearch() {
    return mountWithSearch(SearchBar, {
        resModel: "label.contact",
        searchViewId: false,
        searchViewArch: `<search><field name="name"/><filter name="by_name" string="Preset Name" context="{'group_by': 'name'}"/></search>`,
    });
}

test("custom group choices and facets use labels without changing metadata or keys", async () => {
    const bar = await mountSearch();
    const model = bar.env.searchModel;
    await toggleSearchBarMenu();
    expect(".o_add_custom_group_menu option[value='name']").toHaveText("Contact Group");
    expect(".o_add_custom_group_menu option[value='city']").toHaveText("City");
    expect(model.getSearchItems((item) => item.name === "by_name")[0].description).toBe("Preset Name");
    model.createNewGroupBy("name");
    await animationFrame();
    expect(getFacetTexts()).toEqual(["Contact Group"]);
    expect(model.groupBy).toEqual(["name"]);
    expect(model.searchViewFields.name.string).toBe("Contact Name");
    expect((await getService("field").loadFields("label.contact")).name.string).toBe("Contact Name");
});

test("date group label retains the selected interval", async () => {
    const bar = await mountSearch();
    bar.env.searchModel.createNewGroupBy("birthday", { interval: "year" });
    await animationFrame();
    expect(bar.env.searchModel.groupBy).toEqual(["birthday:year"]);
    expect(getFacetTexts()).toEqual(["Birth Period: Year"]);
});

test("custom filter picker, selected field, facet and edit dialog share the label", async () => {
    const bar = await mountSearch();
    await toggleSearchBarMenu();
    await openAddCustomFilterDialog();
    await openModelFieldSelectorPopover();
    expect(getDisplayedFieldNames()).toInclude("Filter Contact");
    expect(getDisplayedFieldNames()).toInclude("Birthday");
    await contains(".o_model_field_selector_popover_item_name:contains('Filter Contact')").click();
    expect(getCurrentPath()).toBe("Filter Contact");
    await contains(".modal-footer button:contains('Discard')").click();
    await bar.env.searchModel.splitAndAddDomain("[('name', '=', 'Ada')]");
    await animationFrame();
    expect(bar.env.searchModel.domain).toEqual([["name", "=", "Ada"]]);
    expect(getFacetTexts()[0]).toInclude("Filter Contact");
    await contains(".o_searchview_facet_label").click();
    expect(getCurrentPath()).toBe("Filter Contact");
});

test("ordinary domain dialogs retain original labels", async () => {
    await mountSearch();
    getService("dialog").add(DomainSelectorDialog, {
        resModel: "label.contact", domain: "[('name', '=', 'Ada')]", onConfirm() {},
    });
    await animationFrame();
    expect(getCurrentPath()).toBe("Contact Name");
    await openModelFieldSelectorPopover();
    expect(getDisplayedFieldNames()).toInclude("Contact Name");
    expect(getDisplayedFieldNames()).not.toInclude("Filter Contact");
});

test("unconfigured fields fall back in filters and groups", async () => {
    const bar = await mountSearch();
    await bar.env.searchModel.splitAndAddDomain("[('city', '=', 'Jakarta')]");
    bar.env.searchModel.createNewGroupBy("city");
    await animationFrame();
    expect(getFacetTexts().join(" ")).toInclude("City");
    expect(bar.env.searchModel.groupBy).toEqual(["city"]);
    expect(bar.env.searchModel.domain).toEqual([["city", "=", "Jakarta"]]);
});

test("relation path labels are copied per model and virtual properties are left intact", async () => {
    const original = {
        names: ["contact_id", "name"],
        modelsInfo: [
            { resModel: "order", fieldDefs: { contact_id: { string: "Customer", relation: "contact" } } },
            { resModel: "contact", fieldDefs: { name: { string: "Name" } } },
        ],
    };
    const adapter = makeFilterFieldService({ loadPath: async () => original }, async (model) => {
        return model === "contact" ? { name: { filter_label: "Contact Name" } } : {};
    });
    const result = await adapter.loadPath("order", "contact_id.name");
    expect(result.modelsInfo[1].fieldDefs.name.string).toBe("Contact Name");
    expect(original.modelsInfo[1].fieldDefs.name.string).toBe("Name");
    expect(result.names).toEqual(original.names);
});

test("Odoo 19 field path descriptions and field info use scoped relation labels", async () => {
    await mountSearch();
    const field = getService("field");
    const adapter = makeFilterFieldService(field, async () => ({
        ...labels,
        manager_id: { filter_label: "Account Owner" },
    }));
    expect((await adapter.loadPathDescription("label.contact", "manager_id.name")).displayNames)
        .toEqual(["Account Owner", "Filter Contact"]);
    expect((await adapter.loadFieldInfo("label.contact", "manager_id.name")).fieldDef.string)
        .toBe("Filter Contact");
    expect((await field.loadPathDescription("label.contact", "manager_id.name")).displayNames)
        .toEqual(["Manager", "Contact Name"]);
    expect(await adapter.loadPathDescription("label.contact", 1))
        .toEqual({ isInvalid: false, displayNames: ["1"] });
    expect(await adapter.loadPathDescription("label.contact", "", true))
        .toEqual({ isInvalid: false, displayNames: [] });
    expect((await adapter.loadPathDescription("label.contact", "unknown.name")).isInvalid).toBe(true);
});

test("virtual property labels survive paths that follow relational properties", async () => {
    let followProperties;
    const original = {
        names: ["properties", "name"],
        modelsInfo: [
            { resModel: "contact", fieldDefs: { properties: { string: "Properties", type: "properties" } } },
            { resModel: "contact", fieldDefs: { name: { string: "Custom Property", is_property: true } } },
        ],
    };
    const adapter = makeFilterFieldService({
        async loadPath(model, path, follow) { followProperties = follow; return original; },
    }, async () => ({ name: { filter_label: "Physical Field" } }));
    const result = await adapter.loadPath("contact", "properties.name", true);
    expect(followProperties).toBe(true);
    expect(result.modelsInfo[1].fieldDefs.name.string).toBe("Custom Property");
});

test("cache coalesces requests, clears on event, and retries failed requests", async () => {
    const bus = new EventTarget();
    let calls = 0;
    let fail = false;
    const service = searchFieldLabelsService.start({ bus }, {
        field: {},
        orm: { async call() { calls++; if (fail) { throw new Error("offline"); } return labels; } },
    });
    await Promise.all([service.load("contact"), service.load("contact")]);
    expect(calls).toBe(1);
    bus.dispatchEvent(new Event("CLEAR-CACHES"));
    fail = true;
    try { await service.load("contact"); } catch { /* next call must retry */ }
    fail = false;
    expect(await service.load("contact")).toEqual(labels);
    expect(calls).toBe(3);
});

test("cache and dialog adapters keep action and menu scopes separate", async () => {
    const calls = [];
    const service = searchFieldLabelsService.start({ bus: new EventTarget() }, {
        field: { async loadFields() { return { name: { string: "Name" } }; } },
        orm: {
            async call(model, method, args) {
                calls.push(args);
                return { name: { filter_label: `${args[1]}/${args[2]}` } };
            },
        },
    });
    const location = { actionId: 21, menuId: 31 };
    const firstDialog = service.forLocation(location);
    location.menuId = 32;
    const secondDialog = service.forLocation(location);
    expect((await firstDialog.loadFields("contact")).name.string).toBe("21/31");
    expect((await secondDialog.loadFields("contact")).name.string).toBe("21/32");
    await service.load("contact", { actionId: 22, menuId: 32 });
    await firstDialog.loadFields("contact");
    expect(calls).toEqual([["contact", 21, 31], ["contact", 21, 32], ["contact", 22, 32]]);
});

test("location uses explicit action context or restored search state", () => {
    const env = { config: { actionId: 21 }, services: {} };
    expect(getLabelLocation(env, { context: {
        oy_search_field_labels_action_id: 21, oy_search_field_labels_menu_id: 31,
    } })).toEqual({ actionId: 21, menuId: 31 });
    expect(getLabelLocation(env, { context: {} })).toEqual({ actionId: 21, menuId: false });
    expect(getLabelLocation(env, { context: {
        oy_search_field_labels_action_id: 22, oy_search_field_labels_menu_id: 31,
    } })).toEqual({ actionId: 21, menuId: false });
    expect(getLabelLocation(env, { state: { searchFieldLabelLocation: { actionId: 21, menuId: 32 } } }))
        .toEqual({ actionId: 21, menuId: 32 });
});

test("real menu navigation scopes both pickers even when menus share one action", async () => {
    defineModels([webModels.ResUsers, webModels.ResPartner, webModels.ResCompany]);
    labelResolver = ({ args }) => ({ name: {
        filter_label: `Filter ${args[1]}/${args[2]}`,
        group_by_label: `Group ${args[1]}/${args[2]}`,
    } });
    defineActions([
        { id: 2001, name: "Contacts", res_model: "label.contact", type: "ir.actions.act_window", views: [[false, "list"]] },
        { id: 2002, name: "Other Contacts", res_model: "label.contact", type: "ir.actions.act_window", views: [[false, "list"]] },
    ]);
    defineMenus([
        { id: 101, name: "First Contacts", actionID: 2001, xmlid: "label_menu_1" },
        { id: 102, name: "Second Contacts", actionID: 2001, xmlid: "label_menu_2" },
    ]);
    await mountWithCleanup(WebClient);
    for (const menuId of [101, 102]) {
        await getService("menu").selectMenu(menuId);
        await animationFrame();
        await toggleSearchBarMenu();
        expect(".o_add_custom_group_menu option[value='name']").toHaveText(`Group 2001/${menuId}`);
        await openAddCustomFilterDialog();
        await openModelFieldSelectorPopover();
        expect(getDisplayedFieldNames()).toInclude(`Filter 2001/${menuId}`);
        await contains(`.o_model_field_selector_popover_item_name:contains('Filter 2001/${menuId}')`).click();
        expect(getCurrentPath()).toBe(`Filter 2001/${menuId}`);
        await contains(".modal-footer button:contains('Discard')").click();
    }
    await getService("action").doAction(2002);
    await animationFrame();
    await toggleSearchBarMenu();
    expect(".o_add_custom_group_menu option[value='name']").toHaveText("Group 2002/false");
});


test("real route reload keeps menu scope and direct same-action navigation clears it", async () => {
    defineModels([webModels.ResUsers, webModels.ResPartner, webModels.ResCompany]);
    labelResolver = ({ args }) => ({ name: {
        filter_label: `Filter ${args[1]}/${args[2]}`,
        group_by_label: `Group ${args[1]}/${args[2]}`,
    } });
    defineActions([
        { id: 3001, name: "Route Contacts", res_model: "label.contact", type: "ir.actions.act_window",
          context: "{'search_default_name': False, 'label_context_check': uid}", views: [[false, "list"]] },
    ]);
    defineMenus([
        { id: 201, name: "Route First", actionID: 3001, xmlid: "label_route_1" },
        { id: 202, name: "Route Second", actionID: 3001, xmlid: "label_route_2" },
    ]);
    await mountWithCleanup(WebClient);
    const action = getService("action");
    async function assertLabels(menuId) {
        await toggleSearchBarMenu();
        expect(".o_add_custom_group_menu option[value='name']").toHaveText(`Group 3001/${menuId}`);
        await openAddCustomFilterDialog();
        await openModelFieldSelectorPopover();
        expect(getDisplayedFieldNames()).toInclude(`Filter 3001/${menuId}`);
        await contains(`.o_model_field_selector_popover_item_name:contains('Filter 3001/${menuId}')`).click();
        await contains(".modal-footer button:contains('Discard')").click();
    }
    for (const menuId of [201, 202]) {
        await getService("menu").selectMenu(menuId);
        await assertLabels(menuId);
        // Run core's actual browser-route restoration: it consumes current_action
        // from sessionStorage and creates a fresh SearchModel without synthetic context.
        await action.loadState();
        await assertLabels(menuId);
        expect(action.currentController.props.context.label_context_check).toBeGreaterThan(0);
    }
    await action.doAction(3001, { additionalContext: { transient_label_test: true } });
    await assertLabels(false);
    await action.loadState();
    await assertLabels(false);
    expect(action.currentController.props.context.transient_label_test).toBe(undefined);
});
