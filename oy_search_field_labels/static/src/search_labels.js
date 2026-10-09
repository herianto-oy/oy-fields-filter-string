/** @odoo-module **/

import { treeProcessorService } from "@web/core/tree_editor/tree_processor";
import { sortBy } from "@web/core/utils/arrays";
import { patch } from "@web/core/utils/patch";
import { SearchModel } from "@web/search/search_model";
import { SearchBar } from "@web/search/search_bar/search_bar";
import { SearchBarMenu } from "@web/search/search_bar_menu/search_bar_menu";
import { withSearchFilterDialog } from "./search_filter_dialog";
import { makeFilterFieldService } from "./label_service";
import { getLabelLocation } from "./menu_scope";

patch(SearchModel.prototype, {
    setup(services) {
        super.setup(...arguments);
        this.searchFieldLabels = {};
        this.searchFieldLabelLocation = {};
        this.dialog = withSearchFilterDialog(this.dialog, () => this.searchFieldLabelLocation);
        this.treeProcessor = treeProcessorService.start(this.env, {
            field: makeFilterFieldService(services.field, (model) =>
                this.env.services.search_field_labels.load(model, this.searchFieldLabelLocation)
            ),
            name: this.env.services.name,
        });
    },

    async load(config) {
        this.searchFieldLabelLocation = getLabelLocation(this.env, config);
        this.searchFieldLabels = await this.env.services.search_field_labels.load(
            config.resModel, this.searchFieldLabelLocation
        );
        return super.load(...arguments);
    },

    exportState() {
        return { ...super.exportState(...arguments), searchFieldLabelLocation: { ...this.searchFieldLabelLocation } };
    },

    createNewGroupBy(fieldName) {
        const label = this.searchFieldLabels[fieldName]?.group_by_label;
        if (!label || !this.searchViewFields[fieldName]) {
            return super.createNewGroupBy(...arguments);
        }
        // Core creates the item and notifies listeners synchronously. Supply a
        // private metadata copy for this call so the initial facet has its label.
        const originalFields = this.searchViewFields;
        this.searchViewFields = {
            ...originalFields,
            [fieldName]: { ...originalFields[fieldName], string: label },
        };
        try {
            return super.createNewGroupBy(...arguments);
        } finally {
            this.searchViewFields = originalFields;
        }
    },
});

patch(SearchBarMenu.prototype, {
    setup() {
        super.setup(...arguments);
        const labels = this.env.searchModel.searchFieldLabels;
        this.fields = sortBy(
            this.fields.map((field) => ({
                ...field,
                string: labels[field.name]?.group_by_label || field.string,
            })),
            "string"
        );
    },
});

patch(SearchBar.prototype, {
    setup() {
        super.setup(...arguments);
        // Editing a filter facet should use the same labels as creating it.
        this.dialogService = withSearchFilterDialog(
            this.dialogService, () => this.env.searchModel.searchFieldLabelLocation
        );
    },
});
