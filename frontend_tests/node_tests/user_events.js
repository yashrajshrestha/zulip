set_global('$', global.make_zjquery());

zrequire('people');
zrequire('user_events');

set_global('activity', {
    redraw: function () {},
});

set_global('settings_linkifiers', {
    maybe_disable_widgets: function () {},
});
set_global('settings_org', {
    maybe_disable_widgets: function () {},
});
set_global('settings_profile_fields', {
    maybe_disable_widgets: function () {},
});
set_global('settings_streams', {
    maybe_disable_widgets: function () {},
});
set_global('settings_users', {
    update_user_data: function () {},
});

set_global('gear_menu', {
    update_org_settings_menu_item: function () {},
});
set_global('page_params', {
    is_admin: true,
});

set_global('pm_list', {
    update_private_messages: function () {},
});

set_global('narrow_state', {
    update_email: function () {},
});

set_global('compose', {
    update_email: function () {},
});

set_global('settings_account', {
    update_email: function () {},
    update_full_name: function () {},
});

set_global('message_live_update', {
});

set_global('blueslip', global.make_zblueslip());

var me = {
    email: 'me@example.com',
    user_id: 30,
    full_name: 'Me Myself',
    is_admin: true,
};

function initialize() {
    people.init();
    people.add(me);
    people.initialize_current_user(me.user_id);
}

initialize();

run_test('updates', () => {
    var person;

    var isaac = {
        email: 'isaac@example.com',
        user_id: 32,
        full_name: 'Isaac Newton',
    };
    people.add(isaac);

    user_events.update_person({user_id: isaac.user_id, is_guest: true});
    person = people.get_by_email(isaac.email);
    assert(person.is_guest);
    user_events.update_person({user_id: isaac.user_id, is_guest: false});
    person = people.get_by_email(isaac.email);
    assert(!person.is_guest);

    user_events.update_person({user_id: isaac.user_id, is_admin: true});
    person = people.get_by_email(isaac.email);
    assert.equal(person.full_name, 'Isaac Newton');
    assert.equal(person.is_admin, true);

    var user_id;
    var full_name;
    global.message_live_update.update_user_full_name = function (user_id_arg, full_name_arg) {
        user_id = user_id_arg;
        full_name = full_name_arg;
    };

    user_events.update_person({user_id: isaac.user_id, full_name: 'Sir Isaac'});
    person = people.get_by_email(isaac.email);
    assert.equal(person.full_name, 'Sir Isaac');
    assert.equal(person.is_admin, true);
    assert.equal(user_id, isaac.user_id);
    assert.equal(full_name, 'Sir Isaac');

    user_events.update_person({user_id: me.user_id, is_admin: false});
    assert(!global.page_params.is_admin);

    user_events.update_person({user_id: me.user_id, full_name: 'Me V2'});
    assert.equal(people.my_full_name(), 'Me V2');
    assert.equal(user_id, me.user_id);
    assert.equal(full_name, 'Me V2');

    user_events.update_person({user_id: isaac.user_id, new_email: 'newton@example.com'});
    person = people.get_person_from_user_id(isaac.user_id);
    assert.equal(person.email, 'newton@example.com');
    assert.equal(person.full_name, 'Sir Isaac');

    user_events.update_person({user_id: me.user_id, new_email: 'meforu@example.com'});
    person = people.get_person_from_user_id(me.user_id);
    assert.equal(person.email, 'meforu@example.com');
    assert.equal(person.full_name, 'Me V2');

    var avatar_url;
    global.message_live_update.update_avatar = function (user_id_arg, avatar_url_arg) {
        user_id = user_id_arg;
        avatar_url = avatar_url_arg;
    };

    user_events.update_person({user_id: isaac.user_id, full_name: 'Sir Isaac'});
    person = people.get_by_email(isaac.email);
    assert.equal(person.full_name, 'Sir Isaac');
    assert.equal(person.is_admin, true);
    assert.equal(user_id, isaac.user_id);
    assert.equal(full_name, 'Sir Isaac');

    user_events.update_person({user_id: isaac.user_id, avatar_url: 'http://gravatar.com/123456'});
    person = people.get_by_email(isaac.email);
    assert.equal(person.full_name, 'Sir Isaac');
    assert.equal(user_id, isaac.user_id);
    assert.equal(person.avatar_url, avatar_url);

    user_events.update_person({user_id: me.user_id, avatar_url: 'http://gravatar.com/789456'});
    person = people.get_by_email(me.email);
    assert.equal(person.full_name, 'Me V2');
    assert.equal(user_id, me.user_id);
    assert.equal(person.avatar_url, avatar_url);

    user_events.update_person({user_id: me.user_id, timezone: 'UTC'});
    person = people.get_by_email(me.email);
    assert(person.timezone);

    blueslip.set_test_data('error', 'Got update_person event for unexpected user 29');
    blueslip.set_test_data('error', 'Unknown user_id in get_person_from_user_id: 29');
    assert(!user_events.update_person({user_id: 29, full_name: 'Sir Isaac Newton'}));
    assert.equal(blueslip.get_test_logs('error').length, 2);
    blueslip.clear_test_data();

    me.profile_data = {};
    user_events.update_person({user_id: me.user_id, custom_profile_field: {id: 3, value: 'Value', rendered_value: '<p>Value</p>'}});
    person = people.get_by_email(me.email);
    assert.equal(person.profile_data[3].value, 'Value');
    assert.equal(person.profile_data[3].rendered_value, '<p>Value</p>');

    var updated = false;
    settings_account.update_email = (email) => {
        assert.equal(email, 'you@example.org');
        updated = true;
    };

    user_events.update_person({user_id: me.user_id, delivery_email: 'you@example.org'});
    assert(updated);

    var test_bot = {
        email: 'test-bot@example.com',
        user_id: 35,
        full_name: 'Test Bot',
        is_bot: true,
        bot_owner_id: isaac.id,
    };
    people.add(test_bot);

    user_events.update_person({user_id: test_bot.user_id, bot_owner_id: me.user_id});
    person = people.get_by_email(test_bot.email);
    assert.equal(person.bot_owner_id, me.user_id);
});
