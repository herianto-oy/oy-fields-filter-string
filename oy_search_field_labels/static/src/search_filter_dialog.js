/** @odoo-module **/

import { useSubEnv } from "@odoo/owl";
import { DomainSelectorDialog } from "@web/core/domain_selector_dialog/domain_selector_dialog";

export class SearchFilterDialog extends DomainSelectorDialog {
    static props = {
        ...DomainSelectorDialog.props,
        labelLocation: { type: Object, optional: true },
    };

    setup() {
        const services = this.env.services;
        // Popovers live in a separate overlay tree. Forward this scoped environment
        // so the field picker and its relation pages see the same search labels.
        useSubEnv({
            services: {
                ...services,
                field: services.search_field_labels.forLocation(this.props.labelLocation),
                popover: {
                    ...services.popover,
                    add: (target, component, props, options = {}) =>
                        services.popover.add(target, component, props, {
                            ...options,
                            env: this.env,
                        }),
                },
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
            return dialog.add(
                component === DomainSelectorDialog ? SearchFilterDialog : component,
                component === DomainSelectorDialog ? { ...props, labelLocation: { ...getLocation() } } : props,
                options
            );
        },
    };
}
