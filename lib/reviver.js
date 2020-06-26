const { ObjectId } = require('mongodb');

/*
 * This reviver is for simple conversions which are very unlikely to be strings:
 * - ISO Date format, eg: 2020-01-01T23:12:45Z
 * - Object ID, eg: 5e635a877a189f6a101e67a9
 *
 * This is currently unused, because it is simple to use Extended JSON to specify
 * the exact data type for values.
 */
const dateRegex = new RegExp('^\\d\\d\\d\\d-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d');

function reviver(key, value) {
  if (dateRegex.test(value)) {
    return new Date(value);
  }
  if (ObjectId.isValid(value)) {
    return ObjectId(value);
  }
  return value;
}

module.exports = reviver;
