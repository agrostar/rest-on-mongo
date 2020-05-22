const { ObjectId, Long, Int32 } = require('mongodb');

function reviver(key, value) {
  if (value[0] === '$') {
    const [fn, param] = value.split(':');
    switch (fn.toLowerCase()) {
      case '$objectid':
        return ObjectId(param);
      case '$int':
        return Int32(param);
      case '$long':
        return Long(param);
      default:
        console.log('Unknown fn in reviver', fn);
        return param;
    }
  }
  return value;
}

module.exports = reviver;
