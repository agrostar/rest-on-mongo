const { ObjectId, Long } = require('mongodb');

const dateRegex = new RegExp('^\\d\\d\\d\\d-\\d\\d-\\d\\d');

function reviver(key, value) {
  if (value[0] === '$') {
    const colon = value.indexOf(':');
    if (colon === -1) {
      return value;
    }
    const fn = value.slice(0, colon);
    const param = value.slice(colon + 1);
    if (!param) {
      return value;
    }
    switch (fn.toLowerCase()) {
      case '$objectid':
        return ObjectId(param);
      case '$long':
        return Long.fromString(param);
      case '$date':
        return new Date(param);
      case '$string':
        return param;
      default:
        return value;
    }
  } else if (dateRegex.test(value)) {
    return new Date(value);
  }
  return value;
}

module.exports = reviver;
