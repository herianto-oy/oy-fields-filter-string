/** @odoo-module **/

import { useScope } from "@odoo/owl";
import { useSubEnv } from "@web/owl2/utils";
import { DomainSelectorDialog } from "@web/core/domain_selector_dialog/domain_selector_dialog";
import { treeProcessorService } from "@web/core/tree_editor/tree_processor";

export class SearchFilterDialog extends DomainSelectorDialog {
    get labelLocation() {
        return {};
    }

    setup() {
        const services = this.env.services;
        const scope = useScope();
        const field = services.search_field_labels.forLocation(this.labelLocation);
        // Owl 3 overlays inherit their environment through the component scope.
        const scopedOverlay = (overlay) => ({
            add: (target, component, props, options = {}) =>
                overlay.add(target, component, props, { ...options, scope }),
        });
        useSubEnv({
            services: {
                ...services,
                field,
                tree_processor: treeProcessorService.start(this.env, { field, name: services.name }),
                popover: scopedOverlay(services.popover),
                bottom_sheet: scopedOverlay(services.bottom_sheet),
            },
        });
        super.setup();
    }
}

// Wrap only the dialog handles owned by search components, never the global service.
export function withSearchFilterDialog(dialog, getLocation = () => ({})) {
    return {
        ...dialog,
        add(component, props, options) {
            if (component !== DomainSelectorDialog) {
                return dialog.add(component, props, options);
            }
            const location = { ...getLocation() };
            class ScopedSearchFilterDialog extends SearchFilterDialog {
                get labelLocation() {
                    return location;
                }
            }
            return dialog.add(
                ScopedSearchFilterDialog,
                props,
                options
            );
        },
    };
}
