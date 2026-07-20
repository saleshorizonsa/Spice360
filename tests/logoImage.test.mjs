import assert from 'node:assert/strict';
import test from 'node:test';
import { isImageFile, isVectorImage, outputMimeForFile, scaledDimensions } from '../src/lib/logoImage.js';

test('recognises image files and rejects non-images', () => {
  assert.equal(isImageFile({ type: 'image/png' }), true);
  assert.equal(isImageFile({ type: 'image/jpeg' }), true);
  assert.equal(isImageFile({ type: 'application/pdf' }), false);
  assert.equal(isImageFile({}), false);
  assert.equal(isImageFile(null), false);
});

test('detects SVG so it is kept as vector', () => {
  assert.equal(isVectorImage({ type: 'image/svg+xml' }), true);
  assert.equal(isVectorImage({ type: 'image/png' }), false);
});

test('keeps PNG (alpha) for logos, JPEG only for photos', () => {
  assert.equal(outputMimeForFile({ type: 'image/png' }), 'image/png');
  assert.equal(outputMimeForFile({ type: 'image/webp' }), 'image/png'); // unknown -> png keeps alpha
  assert.equal(outputMimeForFile({ type: 'image/jpeg' }), 'image/jpeg');
});

test('scales down oversized images while preserving aspect ratio', () => {
  assert.deepEqual(scaledDimensions(800, 400, 400), { width: 400, height: 200 });
  assert.deepEqual(scaledDimensions(400, 800, 400), { width: 200, height: 400 });
});

test('leaves already-small images untouched', () => {
  assert.deepEqual(scaledDimensions(300, 150, 400), { width: 300, height: 150 });
});

test('handles missing dimensions gracefully', () => {
  assert.deepEqual(scaledDimensions(0, 0, 400), { width: 400, height: 400 });
});
