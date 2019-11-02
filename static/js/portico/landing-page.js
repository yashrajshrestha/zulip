const ELECTRON_APP_VERSION = "4.0.0";
const ELECTRON_APP_URL_LINUX = "https://github.com/zulip/zulip-desktop/releases/download/v" + ELECTRON_APP_VERSION + "/Zulip-" + ELECTRON_APP_VERSION + "-x86_64.AppImage";
const ELECTRON_APP_URL_MAC = "https://github.com/zulip/zulip-desktop/releases/download/v" + ELECTRON_APP_VERSION + "/Zulip-" + ELECTRON_APP_VERSION + ".dmg";
const ELECTRON_APP_URL_WINDOWS = "https://github.com/zulip/zulip-desktop/releases/download/v" + ELECTRON_APP_VERSION + "/Zulip-Web-Setup-" + ELECTRON_APP_VERSION + ".exe";

import { detect_user_os } from './tabbed-instructions.js';
import render_tabs from './team.js';

export function path_parts() {
    return window.location.pathname.split('/').filter(function (chunk) {
        return chunk !== '';
    });
}

var hello_events = function () {
    var counter = 0;
    $(window).scroll(function () {
        if (counter % 2 === 0) {
            $(".screen.hero-screen .message-feed").css("transform", "translateY(-" + $(this).scrollTop() / 5 + "px)");
        }
        counter += 1;
    });

    $(".footer").addClass("hello");
};

var apps_events = function () {
    var info = {
        windows: {
            image: "/static/images/landing-page/microsoft.png",
            alt: "Windows",
            description: "Zulip for Windows is even better than Zulip on the web, with a cleaner look, tray integration, native notifications, and support for multiple Zulip accounts.",
            link: ELECTRON_APP_URL_WINDOWS,
            show_instructions: true,
            install_guide: "/help/desktop-app-install-guide",
        },
        mac: {
            image: "/static/images/landing-page/macbook.png",
            alt: "macOS",
            description: "Zulip on macOS is even better than Zulip on the web, with a cleaner look, tray integration, native notifications, and support for multiple Zulip accounts.",
            link: ELECTRON_APP_URL_MAC,
            show_instructions: true,
            install_guide: "/help/desktop-app-install-guide",
        },
        android: {
            image: "/static/images/app-screenshots/zulip-android.png",
            alt: "Android",
            description: "Zulip's native Android app makes it easy to keep up while on the go.",
            show_instructions: false,
            link: "https://play.google.com/store/apps/details?id=com.zulipmobile",
        },
        ios: {
            image: "/static/images/app-screenshots/zulip-iphone-rough.png",
            alt: "iOS",
            description: "Zulip's native iOS app makes it easy to keep up while on the go.",
            show_instructions: false,
            link: "https://itunes.apple.com/us/app/zulip/id1203036395",
        },
        linux: {
            image: "/static/images/landing-page/ubuntu.png",
            alt: "Linux",
            description: "Zulip on the Linux desktop is even better than Zulip on the web, with a cleaner look, tray integration, native notifications, and support for multiple Zulip accounts.",
            link: ELECTRON_APP_URL_LINUX,
            show_instructions: true,
            install_guide: "/help/desktop-app-install-guide",
        },
    };

    var version;

    function get_version_from_path() {
        var result;
        var parts = path_parts();

        Object.keys(info).forEach(function (version) {
            if (parts.indexOf(version) !== -1) {
                result = version;
            }
        });

        result = result || detect_user_os();
        return result;
    }

    function get_path_from_version() {
        return '/apps/' + version;
    }

    function update_path() {
        var next_path = get_path_from_version();
        history.pushState(version, '', next_path);
    }

    var update_page = function () {
        var $download_instructions = $(".download-instructions");
        var $third_party_apps = $("#third-party-apps");
        var $download_android_apk = $("#download-android-apk");
        var version_info = info[version];

        $(".info .platform").text(version_info.alt);
        $(".info .description").text(version_info.description);
        $(".info .link").attr("href", version_info.link);
        $(".image img").attr("src", version_info.image);
        $download_instructions.find("a").attr("href", version_info.install_guide);

        $download_instructions.toggle(version_info.show_instructions);
        $third_party_apps.toggle(version === "mac" ||
                                 version === "windows" ||
                                 version === "linux");
        $download_android_apk.toggle(version === "android");
    };

    $(window).on('popstate', function () {
        version = get_version_from_path();
        update_page();
        $("body").animate({ scrollTop: 0 }, 200);
    });

    $(".apps a .icon").click(function (e) {
        var next_version = $(e.target).closest('a')
            .attr('href')
            .replace('/apps/', '');
        version = next_version;

        update_path();
        update_page();
        $("body").animate({ scrollTop: 0 }, 200);

        return false;
    });

    // init
    version = get_version_from_path();
    history.replaceState(version, '', get_path_from_version());
    update_page();
};

var events = function () {
    // get the location url like `zulipchat.com/features/`, cut off the trailing
    // `/` and then split by `/` to get ["zulipchat.com", "features"], then
    // pop the last element to get the current section (eg. `features`).
    var location = window.location.pathname.replace(/\/#*$/, "").split(/\//).pop();

    $("[data-on-page='" + location + "']").addClass("active");

    $("body").click(function (e) {
        var $e = $(e.target);

        if ($e.is("nav ul .exit")) {
            $("nav ul").removeClass("show");
        }

        if ($("nav ul.show") && !$e.closest("nav ul.show").length && !$e.is("nav ul.show")) {
            $("nav ul").removeClass("show");
        }
    });

    $(".hamburger").click(function (e) {
        $("nav ul").addClass("show");
        e.stopPropagation();
    });

    if (path_parts().indexOf("apps") !== -1) {
        apps_events();
    }

    if (path_parts().indexOf('hello') !== -1) {
        hello_events();
    }
};


// run this callback when the page is determined to have loaded.
var load = function () {

    // Initiate the bootstrap carousel logic
    $('.carousel').carousel({
        interval: false,
    });

    // Move to the next slide on clicking inside the carousel container
    $(".carousel-inner .item-container").click(function (e) {
        var get_tag_name = e.target.tagName.toLowerCase();
        var is_button = get_tag_name === "button";
        var is_link = get_tag_name === "a";
        var is_last_slide = $("#tour-carousel .carousel-inner .item:last-child").hasClass("active");

        // Do not trigger this event if user clicks on a button, link
        // or if it's the last slide
        var move_slide_forward = !is_button && !is_link && !is_last_slide;

        if (move_slide_forward) {
            $(this).closest('.carousel').carousel('next');
        }
    });

    $('.carousel').on('slid', function () {
        var $this = $(this);
        $this.find('.visibility-control').show();
        if ($this.find('.carousel-inner .item').first().hasClass('active')) {
            $this.find('.left.visibility-control').hide();
        } else if ($this.find('.carousel-inner .item').last().hasClass('active')) {
            $this.find('.right.visibility-control').hide();
        }
    });

    // Set up events / categories / search
    events();
};

if (document.readyState === "complete") {
    load();
} else {
    $(load);
}

$(function () {
    if (window.location.pathname === '/team/') {
        render_tabs();
    }
});

// Prevent Firefox from bfcaching the page.
// According to https://developer.mozilla.org/en-US/docs/DOM/window.onunload
// Using this event handler in your page prevents Firefox from caching the
// page in the in-memory bfcache (backward/forward cache).
$(window).on('unload', function () {
    $(window).unbind('unload');
});
