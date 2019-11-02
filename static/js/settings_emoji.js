var render_admin_emoji_list = require('../templates/admin_emoji_list.hbs');
var render_settings_emoji_settings_tip = require("../templates/settings/emoji_settings_tip.hbs");

var meta = {
    loaded: false,
};

exports.can_add_emoji = function () {
    if (page_params.is_guest) {
        return false;
    }

    if (page_params.is_admin) {
        return true;
    }

    // for normal users, we depend on the setting
    return !page_params.realm_add_emoji_by_admins_only;
};

function can_admin_emoji(emoji) {
    if (page_params.is_admin) {
        return true;
    }
    if (emoji.author === null) {
        // If we don't have the author information then only admin is allowed to disable that emoji.
        return false;
    }
    if (!page_params.realm_add_emoji_by_admins_only && people.is_current_user(emoji.author.email)) {
        return true;
    }
    return false;
}

exports.update_custom_emoji_ui = function () {
    var rendered_tip = render_settings_emoji_settings_tip({
        realm_add_emoji_by_admins_only: page_params.realm_add_emoji_by_admins_only,
    });
    $('#emoji-settings').find('.emoji-settings-tip-container').html(rendered_tip);
    if (page_params.realm_add_emoji_by_admins_only && !page_params.is_admin) {
        $('.admin-emoji-form').hide();
        $('#emoji-settings').removeClass('can_edit');
    } else {
        $('.admin-emoji-form').show();
        $('#emoji-settings').addClass('can_edit');
    }

    exports.populate_emoji(page_params.realm_emoji);
};

exports.reset = function () {
    meta.loaded = false;
};

exports.populate_emoji = function (emoji_data) {
    if (!meta.loaded) {
        return;
    }

    var emoji_table = $('#admin_emoji_table').expectOne();
    var emoji_list = list_render.create(emoji_table, Object.values(emoji_data), {
        name: "emoji_list",
        modifier: function (item) {
            if (item.deactivated !== true) {
                return render_admin_emoji_list({
                    emoji: {
                        name: item.name,
                        display_name: item.name.replace(/_/g, ' '),
                        source_url: item.source_url,
                        author: item.author || '',
                        can_admin_emoji: can_admin_emoji(item),
                    },
                });
            }
            return "";
        },
        filter: {
            element: emoji_table.closest(".settings-section").find(".search"),
            callback: function (item, value) {
                return item.name.toLowerCase().indexOf(value) >= 0;
            },
            onupdate: function () {
                ui.reset_scrollbar(emoji_table);
            },
        },
        parent_container: $("#emoji-settings").expectOne(),
    }).init();

    emoji_list.sort("alphabetic", "name");

    emoji_list.add_sort_function("author_full_name", function (a, b) {
        if (a.author.full_name > b.author.full_name) {
            return 1;
        } else if (a.author.full_name === b.author.full_name) {
            return 0;
        }
        return -1;
    });

    loading.destroy_indicator($('#admin_page_emoji_loading_indicator'));
};

exports.set_up = function () {
    meta.loaded = true;

    loading.make_indicator($('#admin_page_emoji_loading_indicator'));

    // Populate emoji table
    exports.populate_emoji(page_params.realm_emoji);

    $('.admin_emoji_table').on('click', '.delete', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var btn = $(this);

        channel.del({
            url: '/json/realm/emoji/' + encodeURIComponent(btn.attr('data-emoji-name')),
            error: function (xhr) {
                ui_report.generic_row_button_error(xhr, btn);
            },
            success: function () {
                var row = btn.parents('tr');
                row.remove();
            },
        });
    });

    var emoji_widget = emoji.build_emoji_upload_widget();

    $(".organization form.admin-emoji-form").off('submit').on('submit', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var emoji_status = $('#admin-emoji-status');
        $('#admin_emoji_submit').attr('disabled', true);
        var emoji = {};
        var formData = new FormData();
        _.each($(this).serializeArray(), function (obj) {
            emoji[obj.name] = obj.value;
        });
        $.each($('#emoji_file_input')[0].files, function (i, file) {
            formData.append('file-' + i, file);
        });
        channel.post({
            url: "/json/realm/emoji/" + encodeURIComponent(emoji.name),
            data: formData,
            cache: false,
            processData: false,
            contentType: false,
            success: function () {
                $('#admin-emoji-status').hide();
                ui_report.success(i18n.t("Custom emoji added!"), emoji_status);
                $("form.admin-emoji-form input[type='text']").val("");
                $('#admin_emoji_submit').removeAttr('disabled');
                emoji_widget.clear();
            },
            error: function (xhr) {
                $('#admin-emoji-status').hide();
                var errors = JSON.parse(xhr.responseText).msg;
                xhr.responseText = JSON.stringify({msg: errors});
                ui_report.error(i18n.t("Failed"), xhr, emoji_status);
                $('#admin_emoji_submit').removeAttr('disabled');
                emoji_widget.clear();
            },
        });
    });
};

window.settings_emoji = exports;
