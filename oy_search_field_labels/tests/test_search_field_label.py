from psycopg2 import IntegrityError

from odoo.exceptions import AccessError, ValidationError
from odoo.tests import Form, TransactionCase, new_test_user, tagged
from odoo.tools import mute_logger


@tagged("post_install", "-at_install")
class TestSearchFieldLabel(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Label = cls.env["search.field.label"]
        cls.Line = cls.env["search.field.label.line"]
        cls.partner_model = cls.env["ir.model"]._get("res.partner")
        cls.name_field = cls.env["ir.model.fields"]._get("res.partner", "name")
        cls.config = cls.Label.create({"model_id": cls.partner_model.id})
        cls.user = new_test_user(cls.env, login="search_label_reader", groups="base.group_user")

    def _values(self, **overrides):
        return {
            "label_id": self.config.id,
            "field_id": self.name_field.id,
            "filter_label": "Contact Name",
            "group_by_label": "Contact Group",
            **overrides,
        }

    def test_labels_and_original_metadata(self):
        original = self.env["res.partner"].fields_get(["name"])
        self.Line.create(self._values())
        labels = self.Label.with_user(self.user).get_labels("res.partner")
        self.assertEqual(labels["name"], {
            "filter_label": "Contact Name", "group_by_label": "Contact Group",
        })
        self.assertEqual(self.env["res.partner"].fields_get(["name"]), original)

    def test_archive_and_optional_label(self):
        record = self.Line.create(self._values(group_by_label=False))
        self.assertEqual(self.Label.get_labels("res.partner")["name"]["group_by_label"], "")
        record.active = False
        self.assertNotIn("name", self.Label.with_context(active_test=False).get_labels("res.partner"))
        record.active = True
        self.assertIn("name", self.Label.get_labels("res.partner"))
        self.config.active = False
        self.assertEqual(self.Label.with_context(active_test=False).get_labels("res.partner"), {})
        self.config.active = True
        self.assertIn("name", self.Label.get_labels("res.partner"))

    def test_empty_labels_rejected(self):
        for overrides in [
            {"filter_label": False, "group_by_label": False},
            {"filter_label": "  ", "group_by_label": "\t"},
        ]:
            with self.assertRaises(ValidationError), self.cr.savepoint():
                self.Line.create(self._values(**overrides))
        with self.assertRaises(ValidationError), self.cr.savepoint():
            self.Line.create({"label_id": self.config.id, "field_id": self.name_field.id})
        record = self.Line.create(self._values())
        with self.assertRaises(ValidationError), self.cr.savepoint():
            record.write({"filter_label": False, "group_by_label": False})

    def test_field_model_mismatch(self):
        field = self.env["ir.model.fields"]._get("res.users", "login")
        with self.assertRaises(ValidationError), self.cr.savepoint():
            self.Line.create(self._values(field_id=field.id))

    def test_duplicate_including_archived(self):
        self.Line.create(self._values(active=False))
        with self.assertRaises(IntegrityError), mute_logger("odoo.sql_db"), self.cr.savepoint():
            self.Line.create(self._values())

    def test_multiple_configurations_per_model(self):
        config = self.Label.create({"model_id": self.partner_model.id})
        self.assertNotEqual(config, self.config)

    def test_header_model_change_rejected_with_inactive_lines(self):
        self.Line.create(self._values(active=False))
        with self.assertRaises(ValidationError), self.cr.savepoint():
            self.config.model_id = self.env["ir.model"]._get("res.country")

    def test_header_form_with_multiple_field_rows(self):
        with Form(self.Label) as form:
            form.model_id = self.env["ir.model"]._get("res.country")
            with form.line_ids.new() as line:
                line.field_id = self.env["ir.model.fields"]._get("res.country", "name")
                line.filter_label = "Country Name"
            with form.line_ids.new() as line:
                line.field_id = self.env["ir.model.fields"]._get("res.country", "code")
                line.group_by_label = "Country Code"
        config = form.record
        self.assertEqual(len(config.line_ids), 2)
        self.assertEqual(config.line_ids.model_id, config.model_id)
        labels = self.Label.with_user(self.user).get_labels("res.country")
        self.assertEqual(labels["name"]["filter_label"], "Country Name")
        self.assertEqual(labels["code"]["group_by_label"], "Country Code")
        lines = config.line_ids
        config.unlink()
        self.assertFalse(lines.exists())

    def test_translated_labels(self):
        self.env["res.lang"]._activate_lang("id_ID")
        record = self.Line.create(self._values())
        record.with_context(lang="id_ID").write({"filter_label": "Nama Kontak"})
        translated = self.Label.with_user(self.user).with_context(lang="id_ID").get_labels("res.partner")
        self.assertEqual(translated["name"]["filter_label"], "Nama Kontak")
        self.assertEqual(translated["name"]["group_by_label"], "Contact Group")
        self.assertEqual(self.Label.with_context(lang="en_US").get_labels("res.partner")["name"]["filter_label"], "Contact Name")

    def test_internal_users_read_only(self):
        record = self.Line.create(self._values())
        record.with_user(self.user).read(["filter_label"])
        for operation in [
            lambda: self.Line.with_user(self.user).create(self._values()),
            lambda: record.with_user(self.user).write({"filter_label": "Changed"}),
            lambda: record.with_user(self.user).unlink(),
            lambda: self.Label.with_user(self.user).create({"model_id": self.partner_model.id}),
            lambda: self.config.with_user(self.user).write({"active": False}),
            lambda: self.config.with_user(self.user).unlink(),
        ]:
            with self.assertRaises(AccessError), self.cr.savepoint():
                operation()
        with self.assertRaises(AccessError):
            self.Label.with_user(self.env.ref("base.public_user")).get_labels("res.partner")

    def test_model_isolation_and_unknown_model(self):
        self.Line.create(self._values())
        self.assertEqual(self.Label.get_labels("res.country"), {})
        self.assertEqual(self.Label.get_labels("missing.model"), {})

    def test_restricted_fields_not_returned(self):
        field = self.env["ir.model.fields"]._get("res.users", "password")
        config = self.Label.create({"model_id": field.model_id.id})
        self.Line.create({
            "label_id": config.id, "field_id": field.id, "filter_label": "Secret",
        })
        visible = self.env["res.users"].with_user(self.user).fields_get(attributes=["string"])
        labels = self.Label.with_user(self.user).get_labels("res.users")
        self.assertEqual("password" in labels, "password" in visible)
