import test from "node:test";
import assert from "node:assert/strict";
import { imageStorageError } from "../services/imageStorageService.js";

test("image storage distinguishes account configuration from denied create permission", () => {
  const authentication = imageStorageError({ http_code: 401, message: "cloud_name mismatch" });
  assert.equal(authentication.statusCode, 503);
  assert.equal(authentication.code, "IMAGE_STORAGE_CONFIGURATION");
  const permissions = imageStorageError({
    http_code: 403,
    message: "Server returned unexpected status code - 403",
  });
  assert.equal(permissions.code, "IMAGE_STORAGE_PERMISSIONS");
  assert.match(permissions.message, /upload\/create permission/);
  assert.equal(permissions.providerStatus, 403);
});
test("image storage normalizes timeout and transient failures without exposing provider payloads", () => {
  assert.equal(
    imageStorageError({ http_code: 499, message: "Request timed out" }).code,
    "IMAGE_STORAGE_TIMEOUT",
  );
  const error = imageStorageError({
    error: { http_code: 500, message: "provider-secret=private-provider-payload" },
  });
  assert.equal(error.code, "IMAGE_STORAGE_UNAVAILABLE");
  assert.equal(error.message.includes("private-provider-payload"), false);
  assert.equal(imageStorageError().statusCode, 503);
});
