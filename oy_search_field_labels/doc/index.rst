Search Field Labels
===================

Use familiar field names in Add Custom Filter and Add Custom Group. Each
configuration selects one model and contains a table of field settings.
Filter and Group By labels are independent and can apply to all internal users,
selected groups, or selected users, across the model or on an exact screen.

Requirements and installation
-----------------------------

Use the addon branch matching your Odoo major version. The module depends on
``base`` and ``web`` and requires a deployment that accepts custom Python and
JavaScript addons, such as Odoo.sh or an on-premise installation. Odoo Online
cannot install this addon. No Enterprise-only dependency is required.

1. Add the directory containing ``oy_search_field_labels`` to ``addons_path``.
2. Restart Odoo and update the Apps list.
3. Find and install **Search Field Labels**. Remove the Apps search filter if
   the module is not visible.
4. Enable developer mode to access the Technical settings menu.

Create a configuration
----------------------

A Settings administrator opens **Settings > Technical > Database Structure >
Search Field Labels** and creates a record.

* **Model** selects the model whose field labels will be configured.
* **Description** is an optional note to distinguish configurations.
* **Priority** determines the winner when location and audience scopes match.
* **Apply To** selects the audience: Global, Group, or User.
* **Apply On** selects All Menus / Actions, Specific Action, or Specific Menu.

Under **Field Settings**, add a row for each field. The field picker shows
technical field names and limits choices to the header model. The row also
shows the original field label. Enter a **Filter Label**, a **Group By Label**,
or both. At least one label is required for each row. A field can only occur
once within a configuration, including inactive rows.

Save, reload the browser page, and open the target menu. Choose **Add Custom
Filter** or **Add Custom Group** to see the configured labels. Newly generated
search tags also use these labels. Date grouping keeps its standard intervals.

Remove existing field rows before changing a configuration's model. Deactivate
individual rows or archive the whole configuration to stop applying its labels.

Choose who sees the labels
--------------------------

Global
    Applies to all internal users.

Group
    Applies to members of any selected group, including implied memberships.
    Select at least one group.

User
    Applies to the selected internal users. Select at least one user. Portal
    and public users cannot be selected.

Configurations apply across companies. Settings administrators have full
configuration access; internal users have read access. Labels do not grant
access to records or fields and do not change which fields are searchable or
groupable.

Choose where labels apply
-------------------------

All Menus / Actions
    Applies wherever the selected model uses the supported custom search UI.

Specific Action
    Applies to the selected window action, which must open the header model.

Specific Menu
    Applies to that exact selected menu and its window action. A parent menu
    does not match. Two menus sharing the same action can have different labels.

Direct actions opened without a menu use action and global rules. A browser
reload restores the last selected menu for that action in the same browser tab.

Overlapping configurations
--------------------------

Matching Filter and Group By labels are resolved independently in this order:

1. Location specificity: Menu, then Action, then All Menus / Actions.
2. At the same location specificity: User, then Group, then Global.
3. At equal scopes: higher Priority wins.
4. At equal priority: the newest configuration wins.

An empty label inherits the next matching configured label, then the original
Odoo field label. Archiving a configuration or disabling a row restores the
next applicable label.

For example, a global model rule may rename Salesperson to Sales PIC. A
user-specific rule for one exact menu may override only Group By Label to
Account Manager. That user sees Account Manager for custom grouping on that
menu while custom filtering can still inherit Sales PIC.

Translations and saved searches
-------------------------------

Filter Label and Group By Label support Odoo translations. Reload the page after
changing labels, the current language, or user and group memberships.

Favorite names remain user-defined. Existing saved descriptions are not rewritten.
Newly created filters use the currently applicable labels.

Scope of this addon
-------------------

The addon changes label display in custom filter field selection, related field
paths, generated custom filter tags and their edit dialogs, custom group field
selection, date intervals, and generated custom group tags.

Preset filters and groups, form and list labels, export and import labels, and
technical domain or group keys keep their standard behavior. Field definitions
and their original descriptions are not rewritten.

Troubleshooting
---------------

A label is not shown
    Reload the page. Check that the configuration and field row are active,
    that the current user matches Apply To, and that the opened action or exact
    menu matches Apply On. Check for a higher-priority or more-specific rule.

A field is missing
    Check the chosen model and the user's field access. Odoo's normal filter
    and grouping eligibility still applies.

A standard search item still has its original name
    Configured labels target custom filter and custom group flows. Preset
    search-view filter and group names retain their original behavior.

Support and license
-------------------

Author: Herianto OY

For support, email herianto.oy@gmail.com with the Odoo version, selected model,
configuration scope, and steps to reproduce the issue.

This addon is licensed under LGPL-3. See the included ``LICENSE`` file.
