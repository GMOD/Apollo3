# Login management

Apollo itself does not handle user logins. This lets us keep Apollo simpler and
more secure, since it doesn't store passwords, but means you'll have to set up
third-party logins through Google or Microsoft.

Apollo also allows a single admin-level access root user with a password,
usually for use with the CLI, and a passwordless guest user with configurable
access level.

In order to set up these logins, you'll need Apollo to be hosted at a domain
name that you own (e.g. the "Public IPv4 DNS" of an AWS EC2 instance will not
work).

## Set up Google login:

Follow the instructions here to create a new Google OAuth client:

https://support.google.com/cloud/answer/15549257

For the redirect URI, use `http://{your_url}/apollo/auth/google`. When you're
finished, take note of your client ID and client secret. You'll add these to
your `apollo.env` file (or however else you are managing your Apollo environment
variables). The keys for these values are `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`. Make sure to restart the Apollo Collaboration Server
after updating these values.

## Set up Microsoft login (incomplete)

Follow the instructions here to create a new Microsoft OAuth client:

https://learn.microsoft.com/en-us/azure/active-directory-b2c/tutorial-register-applications

The guide for Microsoft logins is still in development and is incomplete. A
rough sketch for creating the necessary tokens is below. Microsoft logins,
however, require HTTPS access, and this section requires more work to lay out
the requirements and options of working with SSL certificates.

For the redirect URI, use `http://{your_url}/apollo/auth/microsoft`. When you're
finished, take note of your client ID and client secret. You'll add these to
your `apollo.env` file (or however else you are managing your Apollo environment
variables). The keys for these values are `MICROSOFT_CLIENT_ID` and
`MICROSOFT_CLIENT_SECRET`. Make sure to restart the Apollo Collaboration Server
after updating these values.
