from odoo import api, models


class IrModelFields(models.Model):
    _inherit = "ir.model.fields"

    @api.depends("name", "field_description", "model")
    @api.depends_context("search_field_labels_technical_name", "hide_model")
    def _compute_display_name(self):
        if self.env.context.get("search_field_labels_technical_name"):
            for field in self:
                field.display_name = field.name
        else:
            super()._compute_display_name()

    @api.model
    def _search_display_name(self, operator, value):
        if self.env.context.get("search_field_labels_technical_name"):
            return [("name", operator, value)]
        return super()._search_display_name(operator, value)
