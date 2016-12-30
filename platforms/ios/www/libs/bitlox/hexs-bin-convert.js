/**
 * "1A 2B 3C" のような16進数表記文字列をバイト配列に変換する
 */
$scope.hexs2bytes = function(hexs) {
    return hexs.split(' ').map(function(h) { return parseInt(h, 16) });
};

/**
 * バイト配列を"1A 2B 3C"のような16進数表記文字列に変換する
 */
$scope.bytes2hexs = function(bytes) {
    return bytes.map(function(b) { var s = b.toString(16); return b < 0x10 ? '0'+s : s; }).join(' ').toUpperCase();
}

/**
 * 整数(int8, int16, int32, int64)をバイト配列に変換する
 */
$scope.int2bytes = function(int) {
    hex = int.toString(16)
    if (hex.length % 2 != 0) {
        hex = '0' + hex;
    }
    var result = [];
    for (var i = 0; i < hex.length; i+= 2) {
        result.push(parseInt(hex.substr(i, 2), 16));
    }
    result.reverse();
    return result;
}

/**
 * バイト配列を整数に変換する
 */
$scope.bytes2int = function(bytes) {
    var bytes_r = bytes.concat().reverse();
    return parseInt(bytes_r.reduce(function(acc, cur) {
        if (cur == 0) return acc;
        var s = cur.toString(16);
        return acc + (cur < 0x10 ? '0'+s : s);
    }), 16);
}