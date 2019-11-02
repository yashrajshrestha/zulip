function maybe_add_narrowed_messages(messages, msg_list) {
    var ids = [];
    _.each(messages, function (elem) {
        ids.push(elem.id);
    });

    channel.get({
        url: '/json/messages/matches_narrow',
        data: {msg_ids: JSON.stringify(ids),
               narrow: JSON.stringify(narrow_state.public_operators())},
        timeout: 5000,
        success: function (data) {
            if (msg_list !== current_msg_list) {
                // We unnarrowed in the mean time
                return;
            }

            var new_messages = [];
            var elsewhere_messages = [];
            _.each(messages, function (elem) {
                if (data.messages.hasOwnProperty(elem.id)) {
                    util.set_match_data(elem, data.messages[elem.id]);
                    new_messages.push(elem);
                } else {
                    elsewhere_messages.push(elem);
                }
            });

            // This second call to add_message_metadata in the
            // insert_new_messages code path helps in very rare race
            // conditions, where e.g. the current user's name was
            // edited in between when they sent the message and when
            // we hear back from the server and can echo the new
            // message.  Arguably, it's counterproductive complexity.
            new_messages = _.map(new_messages, message_store.add_message_metadata);

            message_util.add_new_messages(new_messages, msg_list);
            unread_ops.process_visible();
            notifications.notify_messages_outside_current_search(elsewhere_messages);
        },
        error: function () {
            // We might want to be more clever here
            setTimeout(function () {
                if (msg_list === current_msg_list) {
                    // Don't actually try again if we unnarrowed
                    // while waiting
                    maybe_add_narrowed_messages(messages, msg_list);
                }
            }, 5000);
        }});
}


exports.insert_new_messages = function insert_new_messages(messages, sent_by_this_client) {
    messages = _.map(messages, message_store.add_message_metadata);

    unread.process_loaded_messages(messages);

    // message_list.all is a data-only list that we use to populate
    // other lists, so we always update this
    message_util.add_new_messages(messages, message_list.all);

    var render_info;

    if (narrow_state.active()) {
        // We do this NOW even though the home view is not active,
        // because we want the home view to load fast later.
        message_util.add_new_messages(messages, home_msg_list);

        if (narrow_state.filter().can_apply_locally()) {
            render_info = message_util.add_new_messages(messages, message_list.narrowed);
        } else {
            // if we cannot apply locally, we have to wait for this callback to happen to notify
            maybe_add_narrowed_messages(messages, message_list.narrowed);
        }
    } else {
        // we're in the home view, so update its list
        render_info = message_util.add_new_messages(messages, home_msg_list);
    }


    if (sent_by_this_client) {
        var need_user_to_scroll = render_info && render_info.need_user_to_scroll;
        // sent_by_this_client will be true if ANY of the messages
        // were sent by this client; notifications.notify_local_mixes
        // will filter out any not sent by us.
        notifications.notify_local_mixes(messages, need_user_to_scroll);
    }

    activity.process_loaded_messages(messages);

    unread_ui.update_unread_counts();
    resize.resize_page_components();

    unread_ops.process_visible();
    notifications.received_messages(messages);
    stream_list.update_streams_sidebar();
    pm_list.update_private_messages();
};

exports.update_messages = function update_messages(events) {
    var msgs_to_rerender = [];
    var topic_edited = false;
    var changed_narrow = false;
    var changed_compose = false;
    var message_content_edited = false;

    _.each(events, function (event) {
        var msg = message_store.get(event.message_id);
        if (msg === undefined) {
            return;
        }
        msgs_to_rerender.push(msg);

        message_store.update_booleans(msg, event.flags);

        condense.un_cache_message_content_height(msg.id);

        if (event.rendered_content !== undefined) {
            msg.content = event.rendered_content;
        }

        if (event.is_me_message !== undefined) {
            msg.is_me_message = event.is_me_message;
        }

        var row = current_msg_list.get_row(event.message_id);
        if (row.length > 0) {
            message_edit.end(row);
        }

        var new_topic = util.get_edit_event_topic(event);

        if (new_topic !== undefined) {
            // A topic edit may affect multiple messages, listed in
            // event.message_ids. event.message_id is still the first message
            // where the user initiated the edit.
            topic_edited = true;

            var going_forward_change = _.indexOf(['change_later', 'change_all'], event.propagate_mode) >= 0;

            var stream_name = stream_data.get_sub_by_id(event.stream_id).name;
            var compose_stream_name = compose_state.stream_name();
            var orig_topic = util.get_edit_event_orig_topic(event);

            if (going_forward_change && stream_name && compose_stream_name) {
                if (stream_name.toLowerCase() === compose_stream_name.toLowerCase()) {
                    if (orig_topic === compose_state.topic()) {
                        changed_compose = true;
                        compose_state.topic(new_topic);
                        compose_fade.set_focused_recipient("stream");
                    }
                }
            }

            var current_filter = narrow_state.filter();
            if (going_forward_change) {
                var current_id = current_msg_list.selected_id();
                var selection_changed_topic = _.indexOf(event.message_ids, current_id) >= 0;
                if (selection_changed_topic) {
                    if (current_filter && stream_name) {
                        if (current_filter.has_topic(stream_name, orig_topic)) {
                            var new_filter = current_filter.filter_with_new_topic(new_topic);
                            var operators = new_filter.operators();
                            var opts = {
                                trigger: 'topic change',
                                then_select_id: current_id,
                            };
                            narrow.activate(operators, opts);
                            changed_narrow = true;
                        }
                    }
                }
            }

            _.each(event.message_ids, function (id) {
                var msg = message_store.get(id);
                if (msg === undefined) {
                    return;
                }

                // Remove the recent topics entry for the old topics;
                // must be called before we call set_message_topic.
                topic_data.remove_message({
                    stream_id: msg.stream_id,
                    topic_name: util.get_message_topic(msg),
                });

                // Update the unread counts; again, this must be called
                // before we call set_message_topic.
                unread.update_unread_topics(msg, event);

                util.set_message_topic(msg, new_topic);
                util.set_topic_links(msg, util.get_topic_links(event));

                // Add the recent topics entry for the new topics; must
                // be called after we call set_message_topic.
                topic_data.add_message({
                    stream_id: msg.stream_id,
                    topic_name: util.get_message_topic(msg),
                    message_id: msg.id,
                });

                if (!changed_narrow && current_filter && current_filter.can_apply_locally() &&
                    !current_filter.predicate()(msg)) {
                    // This topic edit makes this message leave the
                    // current narrow, which is not being changed as
                    // part of processing this event.  So we should
                    // remove the message from the current/narrowed message list.
                    var cur_row = current_msg_list.get_row(id);
                    if (cur_row !== undefined) {
                        current_msg_list.remove_and_rerender([{id: id}]);
                    }
                }
            });
        }

        if (event.orig_content !== undefined) {
            if (page_params.realm_allow_edit_history) {
                // Most correctly, we should do this for topic edits as
                // well; but we don't use the data except for content
                // edits anyway.
                var edit_history_entry = {
                    edited_by: event.edited_by,
                    prev_content: event.orig_content,
                    prev_rendered_content: event.orig_rendered_content,
                    prev_rendered_content_version: event.prev_rendered_content_version,
                    timestamp: event.edit_timestamp,
                };
                // Add message's edit_history in message dict
                // For messages that are edited, edit_history needs to
                // be added to message in frontend.
                if (msg.edit_history === undefined) {
                    msg.edit_history = [];
                }
                msg.edit_history = [edit_history_entry].concat(msg.edit_history);
            }
            message_content_edited = true;

            // Update raw_content, so that editing a few times in a row is fast.
            msg.raw_content = event.content;
        }

        msg.last_edit_timestamp = event.edit_timestamp;
        delete msg.last_edit_timestr;

        notifications.received_messages([msg]);
        alert_words.process_message(msg);
    });

    // If a topic was edited, we re-render the whole view to get any
    // propagated edits to be updated (since the topic edits can have
    // changed the correct grouping of messages).
    if (topic_edited) {
        home_msg_list.update_muting_and_rerender();
        // However, we don't need to rerender message_list.narrowed if
        // we just changed the narrow earlier in this function.
        if (!changed_narrow && current_msg_list === message_list.narrowed) {
            message_list.narrowed.update_muting_and_rerender();
        }
    } else {
        // If the content of the message was edited, we do a special animation.
        current_msg_list.view.rerender_messages(msgs_to_rerender, message_content_edited);
        if (current_msg_list === message_list.narrowed) {
            home_msg_list.view.rerender_messages(msgs_to_rerender);
        }
    }

    if (changed_compose) {
        // We need to do this after we rerender the message list, to
        // produce correct results.
        compose_fade.update_message_list();
    }

    unread_ui.update_unread_counts();
    stream_list.update_streams_sidebar();
    pm_list.update_private_messages();
};


window.message_events = exports;
