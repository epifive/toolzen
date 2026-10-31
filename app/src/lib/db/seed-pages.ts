/**
 * Default content pages created on install. Buyers edit them from
 * Admin → Pages. `{site_name}` and `{site_email}` are replaced when rendered.
 */
export const DEFAULT_PAGES = [
  {
    slug: "about",
    title: "About Us",
    metaDescription: "Learn more about {site_name} and the free online tools we build.",
    content: `## Who we are

{site_name} is a collection of fast, free and privacy-friendly online tools for images, PDFs, text, developers and SEO.

## Your files stay on your device

Most of our tools run entirely in your web browser. Your files are processed on your own computer and are never uploaded to our servers.

## Contact

Have a suggestion for a new tool? [Get in touch](/contact) — we read every message.`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    metaDescription: "Read how {site_name} collects, uses and protects your information.",
    content: `## Overview

This Privacy Policy explains how {site_name} ("we", "us") handles information when you use our website.

## Files you process

Our tools process files locally in your browser. We do not upload, store or view the files you work with.

## Account information

If you create an account we store your name, email address and a securely hashed password. If you purchase a plan, payments are handled by our payment provider; we never see or store your full card details.

## Cookies and advertising

We use essential cookies to keep you signed in. Third-party vendors, including Google, may use cookies to serve ads based on your prior visits to this and other websites. You can opt out of personalised advertising by visiting Google's Ads Settings.

## Analytics

We may use analytics services to understand how visitors use the site. These services collect anonymous usage information.

## Contact

Questions about this policy? Email us at {site_email}.`,
  },
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    metaDescription: "The terms and conditions for using {site_name}.",
    content: `## Acceptance of terms

By using {site_name} you agree to these terms. If you do not agree, please do not use the website.

## Use of the tools

The tools are provided "as is" without warranty of any kind. You are responsible for the content you process and for keeping backups of your files.

## Accounts and subscriptions

Paid plans renew automatically until cancelled (when paid by card) or expire at the end of the period you purchased. You can cancel at any time from your account page; access continues until the end of the paid period.

## Acceptable use

You may not use the website for any unlawful purpose or attempt to disrupt the service.

## Changes

We may update these terms from time to time. Continued use of the website means you accept the updated terms.

## Contact

Questions about these terms? Email us at {site_email}.`,
  },
];
