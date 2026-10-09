from odoo import Command
from odoo.exceptions import ValidationError
from odoo.tests import Form, TransactionCase, new_test_user, tagged


@tagged("post_install", "-at_install")
class TestLabelScope(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Label = cls.env["search.field.label"]
        cls.model = cls.env["ir.model"]._get("res.partner")
        cls.field = cls.env["ir.model.fields"]._get("res.partner", "name")
        cls.group = cls.env["res.groups"].create({"name": "Search label test group"})
        cls.user = new_test_user(cls.env, login="label_scope_user", groups="base.group_user")
        cls.other_user = new_test_user(cls.env, login="label_scope_other", groups="base.group_user")
        cls.user.write({"groups_id": [Command.link(cls.group.id)]})
        cls.action = cls.env["ir.actions.act_window"].create({
            "name": "Scope Contacts", "res_model": "res.partner", "view_mode": "list,form",
        })
        cls.other_action = cls.action.copy({"name": "Other Contacts"})
        cls.menu = cls.env["ir.ui.menu"].create({
            "name": "Scope Menu", "action": f"ir.actions.act_window,{cls.action.id}",
        })
        cls.other_menu = cls.menu.copy({"name": "Other Menu"})

    def _config(self, label, group_by_label=False, **values):
        return self.Label.create({
            "model_id": self.model.id,
            "line_ids": [Command.create({
                "field_id": self.field.id,
                "filter_label": label,
                "group_by_label": group_by_label,
            })],
            **values,
        })

    def _labels(self, user=None, action=False, menu=False):
        return self.Label.with_user(user or self.user).get_labels("res.partner", action, menu)

    def test_audience_priority_and_per_label_fallback(self):
        self._config("Global", "Global Group")
        self._config("Group", scope="group", group_ids=[Command.link(self.group.id)])
        specific = self._config("User", scope="user", user_ids=[Command.link(self.user.id)])
        self.assertEqual(self._labels()["name"], {"filter_label": "User", "group_by_label": "Global Group"})
        self.assertEqual(self._labels(self.other_user)["name"]["filter_label"], "Global")
        specific.active = False
        self.assertEqual(self._labels()["name"]["filter_label"], "Group")

    def test_groups_match_any_and_membership_is_current(self):
        other_group = self.env["res.groups"].create({"name": "Other label group"})
        self._config("Group", scope="group", group_ids=[Command.set([self.group.id, other_group.id])])
        self.assertEqual(self._labels()["name"]["filter_label"], "Group")
        self.assertEqual(self._labels(self.other_user), {})
        self.user.write({"groups_id": [Command.unlink(self.group.id)]})
        self.assertEqual(self._labels(), {})

    def test_user_scope_uses_authenticated_user(self):
        self._config("Private", scope="user", user_ids=[Command.link(self.user.id)])
        labels = self.Label.with_user(self.other_user).with_context(uid=self.user.id).get_labels("res.partner")
        self.assertEqual(labels, {})

    def test_action_scope_does_not_leak_to_other_actions(self):
        self._config("Global")
        self._config("Action", target_scope="action", action_id=self.action.id)
        self.assertEqual(self._labels(action=self.action.id)["name"]["filter_label"], "Action")
        self.assertEqual(self._labels(action=self.other_action.id)["name"]["filter_label"], "Global")
        self.assertEqual(self._labels()["name"]["filter_label"], "Global")

    def test_menu_scope_distinguishes_menus_sharing_an_action(self):
        self._config("Action", target_scope="action", action_id=self.action.id)
        self._config("Menu", target_scope="menu", menu_id=self.menu.id)
        self.assertEqual(self._labels(action=self.action.id, menu=self.menu.id)["name"]["filter_label"], "Menu")
        self.assertEqual(self._labels(action=self.action.id, menu=self.other_menu.id)["name"]["filter_label"], "Action")
        self.assertEqual(self._labels(action=self.other_action.id, menu=self.menu.id), {})
        self.assertEqual(self._labels(menu=self.menu.id), {})

    def test_location_before_audience_and_priority_ties(self):
        self._config("User Anywhere", scope="user", user_ids=[Command.link(self.user.id)], priority=1000)
        self._config("Action Global", target_scope="action", action_id=self.action.id)
        self._config("Action User", target_scope="action", action_id=self.action.id,
                     scope="user", user_ids=[Command.link(self.user.id)])
        self._config("Menu Low", target_scope="menu", menu_id=self.menu.id, priority=1)
        high = self._config("Menu High", target_scope="menu", menu_id=self.menu.id, priority=20)
        self.assertEqual(self._labels(action=self.action.id)["name"]["filter_label"], "Action User")
        self.assertEqual(self._labels(action=self.action.id, menu=self.menu.id)["name"]["filter_label"], "Menu High")
        self._config("Menu Newest", target_scope="menu", menu_id=self.menu.id, priority=20)
        self.assertEqual(self._labels(action=self.action.id, menu=self.menu.id)["name"]["filter_label"], "Menu Newest")
        high.priority = 30
        self.assertEqual(self._labels(action=self.action.id, menu=self.menu.id)["name"]["filter_label"], "Menu High")

    def test_inactive_line_falls_back_and_scope_combines_with_location(self):
        self._config("Global")
        scoped = self._config("Specific", scope="user", user_ids=[Command.link(self.user.id)],
                              target_scope="action", action_id=self.action.id)
        self.assertEqual(self._labels(self.other_user, action=self.action.id)["name"]["filter_label"], "Global")
        scoped.line_ids.active = False
        self.assertEqual(self._labels(action=self.action.id)["name"]["filter_label"], "Global")

    def test_invalid_audience_and_target_rejected(self):
        wrong_action = self.env["ir.actions.act_window"].create({
            "name": "Countries", "res_model": "res.country", "view_mode": "list",
        })
        folder = self.env["ir.ui.menu"].create({"name": "Folder without action"})
        cases = [
            {"scope": "user"}, {"scope": "group"},
            {"scope": "global", "user_ids": [Command.link(self.user.id)]},
            {"scope": "user", "user_ids": [Command.link(self.env.ref("base.public_user").id)]},
            {"target_scope": "action"}, {"target_scope": "menu"},
            {"target_scope": "action", "action_id": wrong_action.id},
            {"target_scope": "menu", "menu_id": folder.id},
            {"target_scope": "all", "action_id": self.action.id},
        ]
        for values in cases:
            with self.subTest(values=values), self.assertRaises(ValidationError), self.cr.savepoint():
                self._config("Invalid", **values)

    def test_form_scope_selectors_and_target_domains(self):
        with Form(self.Label) as form:
            form.model_id = self.model
            form.scope = "group"
            form.group_ids.add(self.group)
            form.target_scope = "menu"
            form.menu_id = self.menu
            with form.line_ids.new() as line:
                line.field_id = self.field
                line.filter_label = "Scoped Form"
        self.assertEqual(form.record.scope, "group")
        self.assertIn(self.menu, form.record.available_menu_ids)
        self.assertEqual(self._labels(action=self.action.id, menu=self.menu.id)["name"]["filter_label"], "Scoped Form")
        with Form(form.record) as form:
            form.scope = "global"
            form.target_scope = "all"
        self.assertFalse(form.record.group_ids)
        self.assertFalse(form.record.menu_id)
