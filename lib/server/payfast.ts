import crypto from "crypto";

const sandbox = process.env.PAYFAST_SANDBOX !== "false";
const host = sandbox ? "https://sandbox.payfast.co.za" : "https://www.payfast.co.za";

export const PAYFAST = {
    merchantId: process.env.PAYFAST_MERCHANT_ID!,
    merchantKey: process.env.PAYFAST_MERCHANT_KEY!,
    passphrase: process.env.PAYFAST_PASSPHRASE ?? "",
    processUrl: `${host}/eng/process`,
    validateUrl: `${host}/eng/query/validate`,
};

// PayFast expects PHP-style urlencode: spaces as "+", and !'()*~ encoded
const enc = (v: string) =>
    encodeURIComponent(v.trim())
        .replace(/%20/g, "+")
        .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

export type Pairs = [string, string][];

export const buildQuery = (pairs: Pairs) =>
    pairs.map(([k, v]) => `${k}=${enc(v)}`).join("&");

export const sign = (pairs: Pairs, passphrase: string) => {
    let q = buildQuery(pairs);
    if (passphrase) q += `&passphrase=${enc(passphrase)}`;
    return crypto.createHash("md5").update(q).digest("hex");
};