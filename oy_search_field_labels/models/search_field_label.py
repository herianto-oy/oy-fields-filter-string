from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class SearchFieldLabel(models.Model):
    _name = "search.field.label"
    _description = "Search Field Label"
    _rec_name = "model_id"
    _order = "model_id, priority desc, id desc"

    model_id = fields.Many2one(
        "ir.model", string="Model", required=True, ondelete="cascade", index=True
    )
    model_name = fields.Char(
        string="Technical Model", related="model_id.model", store=True, index=True, readonly=True
    )
    line_ids = fields.One2many(
        "search.field.label.line", "label_id", string="Field Settings",
        context={"active_test": False},
    )
    active = fields.Boolean(default=True)
    name = fields.Char(string="Description")
    scope = fields.Selection(
        [("global", "Global"), ("group", "Group"), ("user", "User")],
        string="Apply To", required=True, default="global",
    )
    group_ids = fields.Many2many("res.groups", string="Groups")
    user_ids = fields.Many2many(
        "res.users", string="Users", domain="[('share', '=', False)]",
    )
    target_scope = fields.Selection(
        [("all", "All Menus / Actions"), ("action", "Specific Action"), ("menu", "Specific Menu")],
        string="Apply On", required=True, default="all",
    )
    action_id = fields.Many2one(
        "ir.actions.act_window", string="Action", ondelete="restrict",
        domain="[('res_model', '=', model_name)]",
    )
    menu_id = fields.Many2one("ir.ui.menu", string="Menu", ondelete="restrict")
    menu_action_id = fields.Many2one(
        "ir.actions.act_window", compute="_compute_menu_action", store=True,
    )
    available_menu_ids = fields.Many2many("ir.ui.menu", compute="_compute_available_menus")
    priority = fields.Integer(
        default=10, help="Higher numbers win between configurations with the same audience and location scope.",
    )

    @api.depends("menu_id.action")
    def _compute_menu_action(self):
        for record in self:
            action = record.menu_id.action
            record.menu_action_id = action if action and action._name == "ir.actions.act_window" else False

    @api.depends("model_id")
    def _compute_available_menus(self):
        for record in self:
            actions = self.env["ir.actions.act_window"].search([("res_model", "=", record.model_name)])
            record.available_menu_ids = self.env["ir.ui.menu"].search([
                ("action", "in", [f"ir.actions.act_window,{action.id}" for action in actions]),
            ]) if record.model_id else False

    @api.onchange("scope")
    def _onchange_scope(self):
        if self.scope != "group":
            self.group_ids = False
        if self.scope != "user":
            self.user_ids = False

    @api.onchange("target_scope", "model_id")
    def _onchange_target(self):
        if self.target_scope != "action" or self.action_id.res_model != self.model_name:
            self.action_id = False
        if self.target_scope != "menu" or self.menu_action_id.res_model != self.model_name:
            self.menu_id = False

    @api.constrains("scope", "group_ids", "user_ids")
    def _check_scope(self):
        for record in self:
            if record.scope == "group" and not record.group_ids:
                raise ValidationError(_("Select at least one group."))
            if record.scope == "user" and not record.user_ids:
                raise ValidationError(_("Select at least one user."))
            if record.scope != "group" and record.group_ids or record.scope != "user" and record.user_ids:
                raise ValidationError(_("Groups and users must match the selected Apply To scope."))
            if any(user.share for user in record.user_ids):
                raise ValidationError(_("Select internal users only."))

    @api.constrains("target_scope", "action_id", "menu_id", "model_id")
    def _check_target(self):
        for record in self:
            if record.target_scope == "action":
                if not record.action_id or record.action_id.res_model != record.model_name:
                    raise ValidationError(_("Select a window action for the selected model."))
            if record.target_scope == "menu":
                if not record.menu_action_id or record.menu_action_id.res_model != record.model_name:
                    raise ValidationError(_("Select a menu that opens a window action for the selected model."))
            if record.target_scope != "action" and record.action_id or record.target_scope != "menu" and record.menu_id:
                raise ValidationError(_("Menu and action must match the selected Apply On scope."))

    @api.constrains("model_id", "line_ids")
    def _check_line_models(self):
        for record in self:
            if any(line.field_id.model_id != record.model_id for line in record.line_ids):
                raise ValidationError(_("All fields must belong to the selected model."))

    @api.model
    def get_labels(self, model_name, action_id=False, menu_id=False):
        """Return active labels only for fields the current user can read."""
        self.check_access("read")
        if not isinstance(model_name, str) or model_name not in self.env:
            return {}
        target = self.env[model_name]
        if not target.has_access("read"):
            return {}
        allowed_fields = target.fields_get(attributes=["string"])
        action_id = action_id if type(action_id) is int and action_id > 0 else False
        menu_id = menu_id if type(menu_id) is int and menu_id > 0 else False
        # Stored model_name avoids requiring ordinary users to read ir.model.
        headers = self.search([
            ("model_name", "=", model_name), ("active", "=", True),
            "|", "|", ("scope", "=", "global"),
            "&", ("scope", "=", "group"), ("group_ids", "in", self.env.user._get_group_ids()),
            "&", ("scope", "=", "user"), ("user_ids", "in", [self.env.uid]),
        ], order="id")
        headers = headers.filtered(lambda h: (
            h.target_scope == "all"
            or h.target_scope == "action" and action_id and h.action_id.id == action_id
            or h.target_scope == "menu" and menu_id and action_id
            and h.menu_id.id == menu_id and h.menu_action_id.id == action_id
        ))
        location_rank = {"all": 0, "action": 1, "menu": 2}
        audience_rank = {"global": 0, "group": 1, "user": 2}
        ordered = headers.sorted(key=lambda h: (
            location_rank[h.target_scope], audience_rank[h.scope], h.priority, h.id,
        ))
        lines = self.env["search.field.label.line"].search([
            ("label_id", "in", headers.ids), ("active", "=", True),
        ], order="id")
        lines_by_header = {header.id: [] for header in ordered}
        for line in lines:
            if line.field_name in allowed_fields:
                lines_by_header[line.label_id.id].append(line)
        result = {}
        for header in ordered:
            for line in lines_by_header[header.id]:
                labels = result.setdefault(line.field_name, {"filter_label": "", "group_by_label": ""})
                for usage in labels:
                    value = (line[usage] or "").strip()
                    if value:
                        labels[usage] = value
        return result


class SearchFieldLabelLine(models.Model):
    _name = "search.field.label.line"
    _description = "Search Field Label Line"
    _rec_name = "field_id"
    _order = "sequence, id"

    label_id = fields.Many2one(
        "search.field.label", string="Configuration", required=True,
        ondelete="cascade", index=True,
    )
    sequence = fields.Integer(default=10)
    model_id = fields.Many2one(related="label_id.model_id", store=True, readonly=True)
    field_id = fields.Many2one(
        "ir.model.fields", string="Field", required=True, ondelete="cascade",
        domain="[('model_id', '=', model_id)]",
    )
    field_name = fields.Char(
        string="Technical Field", related="field_id.name", store=True, readonly=True
    )
    original_label = fields.Char(
        string="Original Label", related="field_id.field_description", readonly=True
    )
    filter_label = fields.Char(
        string="Filter Label", translate=True,
        help="Label in custom filters. Leave empty to use the original field label.",
    )
    group_by_label = fields.Char(
        string="Group By Label", translate=True,
        help="Label in custom groups. Leave empty to use the original field label.",
    )
    active = fields.Boolean(default=True)

    _label_field_unique = models.Constraint(
        "UNIQUE(label_id, field_id)",
        "This field is already configured. Check inactive lines too.",
    )

    @api.constrains("label_id", "model_id", "field_id")
    def _check_field_model(self):
        for record in self:
            if record.field_id.model_id != record.label_id.model_id:
                raise ValidationError(_("The field must belong to the selected model."))

    @api.constrains("filter_label", "group_by_label")
    def _check_labels(self):
        for record in self:
            if not (record.filter_label or "").strip() and not (
                record.group_by_label or ""
            ).strip():
                raise ValidationError(_("Enter a Filter Label or a Group By Label."))

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        # Constraints on optional fields are not called if both are omitted.
        records._check_labels()
        return records
