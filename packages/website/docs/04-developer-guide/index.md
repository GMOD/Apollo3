# Developer guide

Apollo provides for various forms of customization through the use of Apollo
plugins. These plugins can be used to customize both the Apollo collaboration
server and the Apollo JBrowse plugin.

All Apollo plugins are JBrowse plugins, so if you have experience working with
those, the ideas here will be familiar to you.

## Server-side plugins

To add a server-side plugin, add a URL for the plugin file to a `PLUGIN_URLS`
entry in
[your `.env` file](../03-multi-user/02-installation/04-configuration-options.md)
(or inject `PLUGIN_URLS` it into the environment by other means, e.g. env
variables).

Examples of server-side plugin capabilities:

- [Custom login](custom-login.md): Add other forms of login to the default
  Google and Microsoft logins.

## Client-side plugins

Client-side plugins are used in exactly the same way as any other JBrowse
plugin. You will add a URL of your plugin file to your `config.json`. For
information on how to do so, see the
[JBrowse docs](https://jbrowse.org/jb2/docs/config_guides/plugins/), and
additionally the [JBrowse guide](../03-multi-user/03-guides/jbrowse.md) in these
docs if you're working with a multi-user collaboration server.
