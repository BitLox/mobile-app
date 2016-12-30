
/**
 * The BLE plugin is loaded asynchronously so the ble
 * variable is set in the onDeviceReady handler.
 */
var platform = cordova.platformId;
console.log('platform: '+platform);
	var appVersion = "2.1.16";
    // "globals" 
	var ble = null;
	var incomingData = '';
	var dataAlmostReady = false;
	var dataReady = false;
	var payloadSize = 0;
	var	vibrationEnabled = true;
	var scriptsToReplace = [];
	var BulkString;

    var incoming = '';
    var prevsD = '';
    var plugin;
    var result;
    var path;
    var deviceUnplugged = false;
    var deviceOpen = false;
    var edge = false;
	var globalPINstatus = null;
	var pinTheFirst = '';
	var currentCommand = '';
	var readyToggle = false;
	var displayMode = '';
	var indexToBeUsedToSend = '';
	var tempTXglobal = '';

	var baseUrl = 'https://bitlox.io/api';


	var serverURL = 'https://insight.bitpay.com/api';
	var serverURLio = 'http://bitlox.io/api';
// 	        http://bitlox.io/api/addr/17XLaSzT7ZpzEJmFvnqEFycoEUXDaXkPcp/totalReceived',{}, 'text')
	



/********************
*	Utility functions
*/

    function pausecomp(milliseconds) {
        var start = new Date().getTime();
        for (var i = 0; i < 1e7; i++) {
            if ((new Date().getTime() - start) > milliseconds) {
                break;
            }
        }
    }


    String.prototype.chunk = function(n) {
        if (typeof n == 'undefined') n = 2;
        return this.match(RegExp('.{1,' + n + '}', 'g'));
    };

    var padding = Array(64).join('0');


// 	Now with padding to ensure the full two character hex is returned
    function d2h(d) {
    	var padding = 2;
        var hex = Number(d).toString(16);
    	padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

		while (hex.length < padding) {
			hex = "0" + hex;
		}
		return hex;
    }

    function h2d(h) {
        return parseInt(h, 16);
    }

    function toHex(str) {
        var hex = '';
        for (var i = 0; i < str.length; i++) {
            hex += '' + str.charCodeAt(i).toString(16);
        }
        return hex;
    }

    function toHexPadded40bytes(str) {
        var hex = '';
        var targetlength = 40;
		var bytes;
        if (str.length <= targetlength) {
            length = str.length;
        }
		hex = Crypto.util.bytesToHex(Crypto.charenc.UTF8.stringToBytes(str));
        while (hex.length < (targetlength*2)) {
            hex += '20';
        }
        return hex;
    }

    function toHexUTF8(str) {
        var hex = '';
		hex = Crypto.util.bytesToHex(Crypto.charenc.UTF8.stringToBytes(str));
        return hex;
    }

    function hex2a(hexx) {
        var hex = hexx.toString(); //force conversion
        var str = '';
        for (var i = 0; i < hex.length; i += 2)
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        return str;
    }

/*************************
*	Utility functions END
*/



/////////////////////////////////////////////////
// functions from Brainwallet for message signing
/////////////////////////////////////////////////

    var key = null;
    var network = null;
    var gen_from = 'pass';
    var gen_compressed = false;
    var gen_eckey = null;
    var gen_pt = null;
    var gen_ps_reset = false;
    var TIMEOUT = 600;
    var timeout = null;

    var PUBLIC_KEY_VERSION = 0;
    var PRIVATE_KEY_VERSION = 0x80;
//     var ADDRESS_URL_PREFIX = 'http://blockchain.info'

    var sgData = null;
    var sgType = 'inputs_io';

    function setErrorState(field, err, msg) {
        var group = field.closest('.controls');
        if (err) {
            group.addClass('has-error');
            group.attr('title',msg);
        } else {
            group.removeClass('has-error');
            group.attr('title','');
        }
    }

    function sgOnChangeType() {
        var id = $(this).attr('name');
        if (sgType!=id)
        {
          sgType = id;
          if (sgData!=null)
            sgSign();
        }
    }

//     function updateAddr(from, to) {
    function updateAddr(to) {
//         var sec = from.val();
        var addr = '';
        var eckey = null;
        var compressed = false;
        try {
            var res = parseBase58Check(sec); 
            var version = res[0];
            var payload = res[1];
            if (payload.length > 32) {
                payload.pop();
                compressed = true;
            }
            eckey = new Bitcoin.ECKey(payload);
            var curve = getSECCurveByName("secp256k1");
            var pt = curve.getG().multiply(eckey.priv);
            eckey.pub = getEncoded(pt, compressed);
            eckey.pubKeyHash = Bitcoin.Util.sha256ripe160(eckey.pub);
            addr = new Bitcoin.Address(eckey.getPubKeyHash());
            addr.version = (version-128)&255;
            setErrorState(from, false);
        } catch (err) {
            setErrorState(from, true, "Bad private key");
        }
        to.val(addr);
        return {"key":eckey, "compressed":compressed, "addrtype":version, "address":addr};
    }

    function sgGenAddr() {
        updateAddr($('#sgSec'), $('#sgAddr'));
    }

    function sgOnChangeSec() {
        $('#sgSig').val('');
        sgData = null;
        clearTimeout(timeout);
        timeout = setTimeout(sgGenAddr, TIMEOUT);
    }

    function fullTrim(message)
    {
        console.log("in FullTrim");
        message = message.replace(/^\s+|\s+$/g, '');
        message = message.replace(/^\n+|\n+$/g, '');
        return message;
    }

    var sgHdr = [
      "-----BEGIN BITCOIN SIGNED MESSAGE-----",
      "-----BEGIN SIGNATURE-----",
      "-----END BITCOIN SIGNED MESSAGE-----"
    ];

    var qtHdr = [
      "-----BEGIN BITCOIN SIGNED MESSAGE-----",
      "-----BEGIN BITCOIN SIGNATURE-----",
      "-----END BITCOIN SIGNATURE-----"
    ];

    function makeSignedMessage(type, msg, addr, sig)
    {
      if (type=='inputs_io')
        return sgHdr[0]+'\n'+msg +'\n'+sgHdr[1]+'\n'+addr+'\n'+sig+'\n'+sgHdr[2];
      else if (type=='armory')
        return sig;
      else
        return qtHdr[0]+'\n'+msg +'\n'+qtHdr[1]+'\nVersion: Bitcoin-qt (1.0)\nAddress: '+addr+'\n\n'+sig+'\n'+qtHdr[2];
    }

    function sgSign() {
      var message = $('#sgMsg').val();
      var p = updateAddr($('#sgSec'), $('#sgAddr'));

      if ( !message || !p.address )
        return;

      message = fullTrim(message);

      if (sgType=='armory') {
        var sig = armory_sign_message (p.key, p.address, message, p.compressed, p.addrtype);
      } else {
        var sig = sign_message(p.key, message, p.compressed, p.addrtype);
      }

      sgData = {"message":message, "address":p.address, "signature":sig};

      $('#sgSig').val(makeSignedMessage(sgType, sgData.message, sgData.address, sgData.signature));
    }

    function sgOnChangeMsg() {
        $('#sgSig').val('');
        sgData = null;
        clearTimeout(timeout);
        timeout = setTimeout(sgUpdateMsg, TIMEOUT);
    }

    function sgUpdateMsg() {
        $('#vrMsg').val($('#sgMsg').val());
    }

    // -- verify --
    function vrOnChangeSig() {
        //$('#vrAlert').empty();
        window.location.hash='#verify';
    }

    function vrPermalink()
    {
      var msg = $('#vrMsg').val();
      var sig = $('#vrSig').val();
      var addr = $('#vrAddr').val();
      return '?vrMsg='+encodeURIComponent(msg)+'&vrSig='+encodeURIComponent(sig)+'&vrAddr='+encodeURIComponent(addr);
    }

    function splitSignature(s)
    {
      var addr = '';
      var sig = s;
      if ( s.indexOf('\n')>=0 )
      {
        var a = s.split('\n');
        addr = a[0];

        // always the last
        sig = a[a.length-1];

        // try named fields
//         Since we are not going to be doing Armory or bt-qt style sigs, we don't need this
//         var h1 = 'Address: ';
//         for (i in a) {
//           var m = a[i];
//           if ( m.indexOf(h1)>=0 )
//             addr = m.substring(h1.length, m.length);
//         }

        // address should not contain spaces
        if (addr.indexOf(' ')>=0)
          addr = '';

        // some forums break signatures with spaces
        sig = sig.replace(" ","");
      }
      console.log("in splitSignature address = " + addr);
      console.log("in splitSignature signature = " + sig);
      return { "address":addr, "signature":sig };
    }

    function splitSignedMessage(s)
    {
      s = s.replace('\r','');

      for (var i=0; i<2; i++ )
      {
        var hdr = i==0 ? sgHdr : qtHdr;

        var p0 = s.indexOf(hdr[0]);
        if ( p0>=0 )
        {
          var p1 = s.indexOf(hdr[1]);
          if ( p1>p0 )
          {
            var p2 = s.indexOf(hdr[2]);
            if ( p2>p1 )
            {
              var msg = s.substring(p0+hdr[0].length+1, p1-1);
              console.log("in splitSignedMessage msg = " + msg);
              var sig = s.substring(p1+hdr[1].length+1, p2-1);
              console.log("in splitSignedMessage sig = " + sig);
              var m = splitSignature(sig);
              msg = fullTrim(msg); // doesn't work without this
              return { "message":msg, "address":m.address, "signature":m.signature };
            }
          }
        }
      }
      return false;
    }

    function vrVerify() {
    console.log("in vrVerify");
        var s = $('#vrSig').val();
    console.log("s: \n" + s);
        var p = splitSignedMessage(s);
        var res = verify_message(p.signature, p.message, PUBLIC_KEY_VERSION);

        if (!res) {
          var values = armory_split_message(s);
          res = armory_verify_message(values);
          p = {"address":values.Address};
        }

        $('#vrAlert').empty();

        var clone = $('#vrError').clone();

        if ( p && res && (p.address==res || p.address==''))
        {
          clone = p.address==res ? $('#vrSuccess').clone() : $('#vrWarning').clone();
          clone.find('#vrAddr').text(res);
        }

        clone.appendTo($('#vrAlert'));

        return false;
    }
    
    
    
    
    function txOnAddDest() {
        var list = $(document).find('.txCC');
        var clone = list.last().clone();
        clone.find('.help-inline').empty();
        clone.find('.control-label').text('Cc');
        var dest = clone.find('#txDest');
        var value = clone.find('#txValue');
        clone.insertAfter(list.last());
        onInput(dest, txOnChangeDest);
        onInput(value, txOnChangeDest);
        dest.val('');
        value.val('');
        $('#txRemoveDest').attr('disabled', false);
        return false;
    }

    function txOnRemoveDest() {
        var list = $(document).find('.txCC');
        if (list.size() == 2)
            $('#txRemoveDest').attr('disabled', true);
        list.last().remove();
        return false;
    }

    function txOnChangeDest() {
        var balance = parseFloat($('#txBalance').val());
        var fval = parseFloat('0'+$('#txValue').val());
        var fee = parseFloat('0'+$('#txFee').val());

        if (fval + fee > balance) {
            fee = balance - fval;
            $('#txFee').val(fee > 0 ? fee : '0.00');
        }

        clearTimeout(timeout);
        timeout = setTimeout(txRebuild, TIMEOUT);
    }


/**
*	Initialize device 
*	parameters: none
*	sends a ~random number as a session id. This random number is echoed in any 
*	subsequent ping requests as a method of ensuring the device has not been reset in the middle of
*	a session. Unloads all wallets & clears memory.
*/
    function initialize_protobuf_encode() {
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();

		var randomnumber= d2h(Math.floor(Math.random()*1000000001));
        console.log("randomnumber: " + randomnumber);

		var bb = new ByteBuffer();
        var parseLength = randomnumber.length
// 	console.log("utx length = " + parseLength);
        var i;
        for (i = 0; i < parseLength; i += 2) {
            var value = randomnumber.substring(i, i + 2);
// 	console.log("value = " + value);		
            var prefix = "0x";
            var together = prefix.concat(value);
// 	console.log("together = " + together);
            var result = parseInt(together);
// 	console.log("result = " + result);

            bb.writeUint8(result);
        }
        bb.flip();
			
        var initializeContents = new Device.Initialize({
            "session_id": bb,
        });

        tempBuffer = initializeContents.encode();
        var tempTXstring = tempBuffer.toString('hex');
//         document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
        // 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0017"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        console.log("init: " + tempTXstring);
		autoCannedTransaction(tempTXstring);
    }



/**
*	Loads wallet via direct input of a wallet number
*	Useful for hidden wallet loading	
*
*	parameters: wallet number
*/
	function directLoadWallet(walletToLoad) {
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();
	
		var walletToLoadNumber = Number(walletToLoad);
        var loadWalletMessage = new Device.LoadWallet({
			"wallet_number": walletToLoadNumber
        });    
        tempBuffer = loadWalletMessage.encode();
        var tempTXstring = tempBuffer.toString('hex');
        document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
	console.log("tempTXstring = " + tempTXstring);
// 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
// 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "000B"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        console.log("tempTXstring = " + tempTXstring);

        autoCannedTransaction(tempTXstring);
	}


/**
*	Deletes wallet via direct input of a wallet number
*	wallet not required to be loaded!	
*
*	parameters: wallet number
*/
	function directDeleteWallet(walletToLoad) {
		currentCommand = 'deleteWallet';
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();
	
		var walletToLoadNumber = Number(walletToLoad);
        var loadWalletMessage = new Device.DeleteWallet({
			"wallet_handle": walletToLoadNumber
        });    
        tempBuffer = loadWalletMessage.encode();
        var tempTXstring = tempBuffer.toString('hex');
        document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
	console.log("tempTXstring = " + tempTXstring);
// 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
// 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0016"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        console.log("tempTXstring = " + tempTXstring);

        autoCannedTransaction(tempTXstring);
	}



/**
*	Returns entropy generated by the device
*	Could be useful for forensic tests of the "randomness" of the entropy generated	
*	Ref: http://www.shannonentropy.netmark.pl
*
*	parameters: entropy_amount, bytes of entropy to return
*/
	function getEntropy(entropy_amount) {
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();
	
		var entropyToGet = Number(entropy_amount);
        var getEntropyMessage = new Device.GetEntropy({
			"number_of_bytes": entropyToGet
        });    
        tempBuffer = getEntropyMessage.encode();
        var tempTXstring = tempBuffer.toString('hex');
        document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
	console.log("tempTXstring = " + tempTXstring);
// 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
// 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0014"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        console.log("tempTXstring = " + tempTXstring);

        autoCannedTransaction(tempTXstring);
	}
	
	function respondToOTPrequest()
	{
		app.displayStatus('OTP request');

		window.plugins.pinDialog.promptClear("Enter OTP shown on BitLox", constructOTP, "OTP", ["CONFIRM","CANCEL"]);

	}


/**
*	Sends OTP response
*	Needed for dangerous operations such as formatting or wallet deletion.	
*
*	parameters: none, but probably should be passed instead of pulled from the page
*/
    function constructOTP(results) {
    	if(results.buttonIndex == 1)
		{
			var ProtoBuf = dcodeIO.ProtoBuf;
			var ByteBuffer = dcodeIO.ByteBuffer;
			var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
				Device = builder.build();

			var otpCommandValue = results.input1;
		
			var otpMessage = new Device.OtpAck({
				"otp": otpCommandValue
			});    

			tempBuffer = otpMessage.encode();
			var tempTXstring = tempBuffer.toString('hex');
			document.getElementById("temp_results").innerHTML = tempTXstring;
			txSize = d2h((tempTXstring.length) / 2).toString('hex');
			console.log("tempTXstring = " + tempTXstring);
			var j;
			var txLengthOriginal = txSize.length;
			for (j = 0; j < (8 - txLengthOriginal); j++) {
				var prefix = "0";
				txSize = prefix.concat(txSize);
			}
			tempTXstring = txSize.concat(tempTXstring);

			var command = "0057"; 
			tempTXstring = command.concat(tempTXstring);

			var magic = "2323"
			tempTXstring = magic.concat(tempTXstring);
			console.log("tempTXstring = " + tempTXstring);
			autoCannedTransaction(tempTXstring);
       }else if(results.buttonIndex == 2){
			app.displayStatus('OTP canceled');
        	app.sliceAndWrite64(deviceCommands.otp_cancel);
        	
        }
    }


/**
*	Sends PIN response
*	DEPRECATED - PINs are now entered exclusively on the device itself	
*
*	parameters: none
*/
	function constructPIN() {
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();
		var pin = Crypto.util.bytesToHex(Crypto.charenc.UTF8.stringToBytes(document.getElementById('pin_input').value));
		
		var bbPIN = new ByteBuffer();
        var parseLength = pin.length
// 	console.log("utx length = " + parseLength);
        var i;
        for (i = 0; i < parseLength; i += 2) {
            var value = pin.substring(i, i + 2);
// 	console.log("value = " + value);		
            var prefix = "0x";
            var together = prefix.concat(value);
// 	console.log("together = " + together);
            var result = parseInt(together);
// 	console.log("result = " + result);

            bbPIN.writeUint8(result);
        }
        bbPIN.flip();
        
        var pinAckMessage = new Device.PinAck({
			"password": bbPIN
        });    

        tempBuffer = pinAckMessage.encode();
        var tempTXstring = tempBuffer.toString('hex');
        document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
	console.log("tempTXstring = " + tempTXstring);
// 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
// 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0054"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        console.log("tempTXstring = " + tempTXstring);

        autoCannedTransaction(tempTXstring);
 	}



	function constructPing() {
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();
		var pin = Crypto.util.bytesToHex(Crypto.charenc.UTF8.stringToBytes(document.getElementById('ping_input').value));
		
        var pinAckMessage = new Device.Ping({
			"greeting": document.getElementById('ping_input').value
        });    

        tempBuffer = pinAckMessage.encode();
        var tempTXstring = tempBuffer.toString('hex');
        document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
	console.log("tempTXstring = " + tempTXstring);
// 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
// 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0000"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        console.log("tempTXstring = " + tempTXstring);

        autoCannedTransaction(tempTXstring);
	
	}
	
	
	function putAll() {
	        console.log("In putAll"); 
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();
// 		var pin = Crypto.util.bytesToHex(Crypto.charenc.UTF8.stringToBytes(document.getElementById('ping_input').value));
		
		var bbBulk = new ByteBuffer();
        var parseLength = BulkString.length
// 	console.log("utx length = " + parseLength);
        var i;
        for (i = 0; i < parseLength; i += 2) {
            var value = BulkString.substring(i, i + 2);
// 	console.log("value = " + value);		
            var prefix = "0x";
            var together = prefix.concat(value);
// 	console.log("together = " + together);
            var result = parseInt(together);
// 	console.log("result = " + result);

            bbBulk.writeUint8(result);
        }
        bbBulk.flip();
        
        var BulkMessage = new Device.SetBulk({
			"bulk": bbBulk
        });    

	
        tempBuffer = BulkMessage.encode();
        var tempTXstring = tempBuffer.toString('hex');
        document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
// 	console.log("tempTXstring = " + tempTXstring);
	console.log("txSize = " + txSize);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
// 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0083"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
//         console.log("tempTXstring = " + tempTXstring);

        autoCannedTransaction(tempTXstring);
	
	}



////////////////////////////
// Restore wallet
// document.getElementById('restore_wallet_input').value
// Responses: Success or Failure
// Response interjections: ButtonRequest
// wallet_name is stored purely for the convenience of the host. It should be
// a null-terminated UTF-8 encoded string with a maximum length of 40 bytes.
// To create an unencrypted wallet, exclude password.
// message NewWallet
// {
// 	optional uint32 wallet_number = 1 ;//[default = 0];
// 	optional bytes password = 2;
// 	optional bytes wallet_name = 3;
// 	optional bool is_hidden = 4 ;//[default = false];
// }
// Responses: Success or Failure
// Response interjections: ButtonRequest
// message RestoreWallet
// {
// 	required NewWallet new_wallet = 1;
// 	required bytes seed = 2;
// }
// 
// 
////////////////////////////

    function constructNewWalletRestore() {
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();
        
// WALLET NUMBER
// 		var walletNumber = Number(document.getElementById('new_wallet_number').value);
		var walletNumber = 49;
		
// PASSWORD *DEPRECATED* Value in this field merely toggles the on-device password routine
		var passwordString = '1';
		if (passwordString != ''){
			var password = Crypto.util.bytesToHex(Crypto.charenc.UTF8.stringToBytes(passwordString));
			console.log("pass: " + password);    
			var bbPass = new ByteBuffer();
			var parseLength = password.length
	// 	console.log("utx length = " + parseLength);
			var i;
			for (i = 0; i < parseLength; i += 2) {
				var value = password.substring(i, i + 2);
	// 	console.log("value = " + value);		
				var prefix = "0x";
				var together = prefix.concat(value);
	// 	console.log("together = " + together);
				var result = parseInt(together);
	// 	console.log("result = " + result);

				bbPass.writeUint8(result);
			}
			bbPass.flip();
		}else{
			var bbPass = null;
		}
		
// NAME
        var nameToUse = document.getElementById('new_wallet_name').value;
        console.log("name: " + nameToUse);    
            
        var nameToUseHexed = toHexPadded40bytes(nameToUse);    
        console.log("namehexed: " + nameToUseHexed);    
        
		var bbName = new ByteBuffer();
        var parseLength = nameToUseHexed.length
// 	console.log("utx length = " + parseLength);
        var i;
        for (i = 0; i < parseLength; i += 2) {
            var value = nameToUseHexed.substring(i, i + 2);
// 	console.log("value = " + value);		
            var prefix = "0x";
            var together = prefix.concat(value);
// 	console.log("together = " + together);
            var result = parseInt(together);
// 	console.log("result = " + result);

            bbName.writeUint8(result);
        }
        bbName.flip();
// end NAME        
        
        
// HIDDEN
		var is_hidden = document.getElementById("new_wallet_isHidden").checked;

        
        var newWalletMessage = new Device.NewWallet({
        	"wallet_number": walletNumber
        	,
        	"password": bbPass
        	,
        	"wallet_name": bbName
        	,
        	"is_hidden": is_hidden
        });    

		var restoreSeed = document.getElementById('restore_wallet_input').value;

		var sizeOfSeed =  restoreSeed.length;
        console.log("sizeOfSeed = " + sizeOfSeed);

        var bb = ByteBuffer.allocate((sizeOfSeed/2)+64);

        var i;
        for (i = 0; i < sizeOfSeed; i += 2) {
            var value = restoreSeed.substring(i, i + 2);
            // 		console.log("value = " + value);		
            var prefix = "0x";
            var together = prefix.concat(value);
            // 		console.log("together = " + together);
            var result = parseInt(together);
            // 		console.log("result = " + result);

            bb.writeUint8(result);
        }
        bb.flip();


		var restoreWalletMessage = new Device.RestoreWallet({
			"new_wallet" : newWalletMessage
			,
			"seed" : bb
		});            
        tempBuffer = newWalletMessage.encode();
        var tempTXstring = tempBuffer.toString('hex');
        document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
	console.log("tempTXstring = " + tempTXstring);
// 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
// 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0012"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        console.log("tempTXstring = " + tempTXstring);

        autoCannedTransaction(tempTXstring);

//         return renameCommand;
    }
    
    
////////////////////////////
// New wallet
// 
// Responses: Success or Failure
// Response interjections: ButtonRequest
// wallet_name is stored purely for the convenience of the host. It should be
// a null-terminated UTF-8 encoded string with a maximum length of 40 bytes.
// To create an unencrypted wallet, exclude password.
// message NewWallet
// {
// 	optional uint32 wallet_number = 1 ;//[default = 0];
// 	optional bytes password = 2;
// 	optional bytes wallet_name = 3;
// 	optional bool is_hidden = 4 ;//[default = false];
// }
////////////////////////////


	function onPromptNewWallet(results) {
		if(results.buttonIndex == 1)
		{
			app.displayStatus('Creating wallet');
			window.plugins.toast.show('Check your BitLox', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
			constructNewWallet(results.input1);
		}else if(results.buttonIndex == 2)
		{
			window.plugins.toast.show('Canceled', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
		}
	}

////////////////////////////
// New wallet
// 
// Responses: Success or Failure
// Response interjections: ButtonRequest
// wallet_name is stored purely for the convenience of the host. It should be
// a null-terminated UTF-8 encoded string with a maximum length of 40 bytes.
// To create an unencrypted wallet, exclude password.
// message NewWallet
// {
// 	optional uint32 wallet_number = 1 ;//[default = 0];
// 	optional bytes password = 2;
// 	optional bytes wallet_name = 3;
// 	optional bool is_hidden = 4 ;//[default = false];
// }
////////////////////////////

    function constructNewWallet(nameToUse) {
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();
        
// WALLET NUMBER
// 		var walletNumber = Number(document.getElementById('new_wallet_number').value);
		var walletNumber = 49;
		
// PASSWORD *DEPRECATED* Value in this field merely toggles the on-device password routine
// 		var passwordString = document.getElementById('new_wallet_password').value;
		var passwordString = 'fred';
		if (passwordString != ''){
			var password = Crypto.util.bytesToHex(Crypto.charenc.UTF8.stringToBytes(passwordString));
			console.log("pass: " + password);    
			var bbPass = new ByteBuffer();
			var parseLength = password.length
	// 	console.log("utx length = " + parseLength);
			var i;
			for (i = 0; i < parseLength; i += 2) {
				var value = password.substring(i, i + 2);
	// 	console.log("value = " + value);		
				var prefix = "0x";
				var together = prefix.concat(value);
	// 	console.log("together = " + together);
				var result = parseInt(together);
	// 	console.log("result = " + result);

				bbPass.writeUint8(result);
			}
			bbPass.flip();
		}else{
			var bbPass = null;
		}
		
// NAME
//         var nameToUse = document.getElementById('new_wallet_name').value;
        console.log("name: " + nameToUse);    
            
        var nameToUseHexed = toHexPadded40bytes(nameToUse);    
        console.log("namehexed: " + nameToUseHexed);    
        
		var bbName = new ByteBuffer();
        var parseLength = nameToUseHexed.length
// 	console.log("utx length = " + parseLength);
        var i;
        for (i = 0; i < parseLength; i += 2) {
            var value = nameToUseHexed.substring(i, i + 2);
// 	console.log("value = " + value);		
            var prefix = "0x";
            var together = prefix.concat(value);
// 	console.log("together = " + together);
            var result = parseInt(together);
// 	console.log("result = " + result);

            bbName.writeUint8(result);
        }
        bbName.flip();
// end NAME        
        
        
// HIDDEN
// 		var is_hidden = document.getElementById("new_wallet_isHidden").checked;
		var is_hidden = false;

        
        var newWalletMessage = new Device.NewWallet({
        	"wallet_number": walletNumber
        	,
        	"password": bbPass
        	,
        	"wallet_name": bbName
        	,
        	"is_hidden": is_hidden
        });    
            
        tempBuffer = newWalletMessage.encode();
        var tempTXstring = tempBuffer.toString('hex');
        document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
	console.log("tempTXstring = " + tempTXstring);
// 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
// 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0004"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        console.log("tempTXstring = " + tempTXstring);

        autoCannedTransaction(tempTXstring);

//         return renameCommand;
    }




////////////////////////////
// Device Restore wallet
// 
// Responses: Success or Failure
// Response interjections: ButtonRequest
// wallet_name is stored purely for the convenience of the host. It should be
// a null-terminated UTF-8 encoded string with a maximum length of 40 bytes.
// To create an unencrypted wallet, exclude password.
// 
// Uses NewWallet message type
// message NewWallet
// {
// 	optional uint32 wallet_number = 1 ;//[default = 0];
// 	optional bytes password = 2;
// 	optional bytes wallet_name = 3;
// 	optional bool is_hidden = 4 ;//[default = false];
// }
////////////////////////////

    function constructDeviceRestoreWallet() {
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();
        
// WALLET NUMBER
		var walletNumber = 49;
		
// PASSWORD *DEPRECATED* Value in this field merely toggles the on-device password routine
		var passwordString = '1';
		if (passwordString != ''){
			var password = Crypto.util.bytesToHex(Crypto.charenc.UTF8.stringToBytes(passwordString));
			console.log("pass: " + password);    
			var bbPass = new ByteBuffer();
			var parseLength = password.length
	// 	console.log("utx length = " + parseLength);
			var i;
			for (i = 0; i < parseLength; i += 2) {
				var value = password.substring(i, i + 2);
	// 	console.log("value = " + value);		
				var prefix = "0x";
				var together = prefix.concat(value);
	// 	console.log("together = " + together);
				var result = parseInt(together);
	// 	console.log("result = " + result);

				bbPass.writeUint8(result);
			}
			bbPass.flip();
		}else{
			var bbPass = null;
		}
		
// NAME
        var nameToUse = 'Restored wallet';
        console.log("name: " + nameToUse);    
            
        var nameToUseHexed = toHexPadded40bytes(nameToUse);    
        console.log("namehexed: " + nameToUseHexed);    
        
		var bbName = new ByteBuffer();
        var parseLength = nameToUseHexed.length
// 	console.log("utx length = " + parseLength);
        var i;
        for (i = 0; i < parseLength; i += 2) {
            var value = nameToUseHexed.substring(i, i + 2);
// 	console.log("value = " + value);		
            var prefix = "0x";
            var together = prefix.concat(value);
// 	console.log("together = " + together);
            var result = parseInt(together);
// 	console.log("result = " + result);

            bbName.writeUint8(result);
        }
        bbName.flip();
// end NAME        
        
        
// HIDDEN
		var is_hidden = false;

        
        var newWalletMessage = new Device.NewWallet({
        	"wallet_number": walletNumber
        	,
        	"password": bbPass
        	,
        	"wallet_name": bbName
        	,
        	"is_hidden": is_hidden
        });    
            
        tempBuffer = newWalletMessage.encode();
        var tempTXstring = tempBuffer.toString('hex');
        document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
	console.log("tempTXstring = " + tempTXstring);
// 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
// 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0018"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        console.log("tempTXstring = " + tempTXstring);

        autoCannedTransaction(tempTXstring);
    }

////////////////////////////
// Rename device
////////////////////////////
	function onPromptRenameDevice(resultsRename) {
		if(resultsRename.buttonIndex == 1)
		{
			var nameToUseHexed = toHexUTF8(resultsRename.input1);
			var nameArrayBytes = Crypto.util.hexToBytes(nameToUseHexed);
			var nameArray = new Uint8Array(nameArrayBytes);
			app.writeDeviceName(nameArray);
		}else if(resultsRename.buttonIndex == 2)
		{
			window.plugins.toast.show('Canceled', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
			$('#renameDeviceButton').attr('disabled',false);
		}
	}




////////////////////////////
// Rename loaded wallet
////////////////////////////

	function onPromptRename(resultsRename) {
		if(resultsRename.buttonIndex == 1)
		{
			window.plugins.toast.show('Check your BitLox', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
			constructRenameWallet(resultsRename.input1)
		}else if(resultsRename.buttonIndex == 2)
		{
			window.plugins.toast.show('Canceled', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
		}
	}

    function constructRenameWallet(nameToUse) {
// 		app.displayStatus('Renaming wallet');

        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();
        
//         var nameToUse = document.getElementById('rename_wallet_input').value;
        console.log("name: " + nameToUse);    
            
        var nameToUseHexed = toHexPadded40bytes(nameToUse);    
        console.log("namehexed: " + nameToUseHexed);    
        
		var bb = new ByteBuffer();
        var parseLength = nameToUseHexed.length
// 	console.log("utx length = " + parseLength);
        var i;
        for (i = 0; i < parseLength; i += 2) {
            var value = nameToUseHexed.substring(i, i + 2);
// 	console.log("value = " + value);		
            var prefix = "0x";
            var together = prefix.concat(value);
// 	console.log("together = " + together);
            var result = parseInt(together);
// 	console.log("result = " + result);

            bb.writeUint8(result);
        }
        bb.flip();
        
        
        
        var walletrenameContents = new Device.ChangeWalletName({
        	"wallet_name": bb
        });    
            
        tempBuffer = walletrenameContents.encode();
        var tempTXstring = tempBuffer.toString('hex');
        document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
	console.log("tempTXstring = " + tempTXstring);
// 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
// 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "000F"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        console.log("tempTXstring = " + tempTXstring);

        autoCannedTransaction(tempTXstring);

//         return renameCommand;
    }


////////////////////////////
// Sign Message with address
////////////////////////////

	function signMessageWithDevice() {
		console.log("in signMessageWithDevice ########@@@@@@@@@@@@@@");
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();


	   	var message_string = document.getElementById("sgMsg").value;
	    message_string = fullTrim(message_string);
	    document.getElementById("sgMsgHidden").value = message_string;

		var message_concat_bytes = msg_bytes("Bitcoin Signed Message:\n").concat(msg_bytes(message_string));
		console.log("2b hashed msg bytes: " + message_concat_bytes);

		var message_concat_hex = Crypto.util.bytesToHex(message_concat_bytes);
		console.log("2b hashed msg hex: " +  message_concat_hex);


		
		address_handle_root = Number(document.getElementById("sgRoot").value);
		address_handle_chain = Number(document.getElementById("sgChain").value);
		address_handle_index = Number(document.getElementById("sgIndex").value);

console.log("address_handle_root " + address_handle_root);
console.log("address_handle_chain " + address_handle_chain);
console.log("address_handle_index " + address_handle_index);
		
		var bb = new ByteBuffer();
        var parseLength = message_concat_hex.length
// 	console.log("utx length = " + parseLength);
        var i;
        for (i = 0; i < parseLength; i += 2) {
            var value = message_concat_hex.substring(i, i + 2);
// 	console.log("value = " + value);		
            var prefix = "0x";
            var together = prefix.concat(value);
// 	console.log("together = " + together);
            var result = parseInt(together);
// 	console.log("result = " + result);

            bb.writeUint8(result);
        }
        bb.flip();

		var txContents = new Device.SignMessage({
		"address_handle_extended": 
				{
					"address_handle_root": address_handle_root, 
					"address_handle_chain": address_handle_chain, 
					"address_handle_index": address_handle_index
				},
		"message_data": bb
// 		,
// 		"message_data": message_string
		});
        tempBuffer = txContents.encode();
        var tempTXstring = tempBuffer.toString('hex');
        document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
// 	console.log("txSize = " + txSize);
// 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
// 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0070"; 
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        console.log("tempTXstring = " + tempTXstring);

        autoCannedTransaction(tempTXstring);
		
	}


	
////////////////////////////
// Sign Transaction Prep
////////////////////////////

    var prepForSigning = function(unsignedtx, originatingTransactionArray, originatingTransactionArrayIndices, address_handle_chain, address_handle_index) {
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();
		var numberOfInputsinArray = originatingTransactionArray.length;
        console.log("numberOfInputsinArray: " + numberOfInputsinArray);
            
		var m;
		for(m = 0; m < numberOfInputsinArray; m++)
        {    
	        console.log("Originating Transaction "+m+": " + originatingTransactionArray[m]);
		}

        
        
		var address_handle_root = [];
		for(m = 0; m < numberOfInputsinArray; m++)
		{
			address_handle_root[m] = 0;
		}
		
		var address_handle_extended_data = []; // empty array
		var k;
		for (k=0;k<numberOfInputsinArray;k++)
		{
			address_handle_extended_data.push({address_handle_root: address_handle_root[k], address_handle_chain: address_handle_chain[k], address_handle_index: address_handle_index[k]});
		}
		console.log(JSON.stringify(address_handle_extended_data));




// INPUTS
		var inputHexTemp = "";
		var j;
		for (j=0; j<numberOfInputsinArray; j++){
//         wrapper:
			var tempOriginating = "";
			var is_ref01 = "01";
			var output_num_select = valueFromInteger(originatingTransactionArrayIndices[j]);
//         previous transaction data:
			output_num_select = Crypto.util.bytesToHex(output_num_select);
			console.log("output_num_select: " + j +" : "+ output_num_select);
			tempOriginating = is_ref01.concat(output_num_select);
			tempOriginating = tempOriginating.concat(originatingTransactionArray[j]);
			inputHexTemp = inputHexTemp.concat(tempOriginating);
		}
// END INPUTS
        var tempBuffer = ByteBuffer.allocate(1024);
// OUTPUTS
        var is_ref00 = "00";
        unsignedtx = is_ref00.concat(unsignedtx);
        console.log("utx = " + unsignedtx);
        var hashtype = "01000000";
        unsignedtx = unsignedtx.concat(hashtype);

        unsignedtx = inputHexTemp.concat(unsignedtx);
        
		var sizeOfInput =  unsignedtx.length;
        console.log("sizeOfInput = " + sizeOfInput);

        var bb = ByteBuffer.allocate((sizeOfInput/2)+64);

        var i;
        for (i = 0; i < sizeOfInput; i += 2) {
            var value = unsignedtx.substring(i, i + 2);
            // 		console.log("value = " + value);		
            var prefix = "0x";
            var together = prefix.concat(value);
            // 		console.log("together = " + together);
            var result = parseInt(together);
            // 		console.log("result = " + result);

            bb.writeUint8(result);
        }
        bb.flip();
// END OUTPUTS


		for(m = 0; m < numberOfInputsinArray; m++)
		{
			console.log("address_handle_root["+m+"]" + address_handle_root[m]);       
			console.log("address_handle_chain["+m+"]" + address_handle_chain[m]);       
			console.log("address_handle_index["+m+"]" + address_handle_index[m]);       
      	}

        var txContents = new Device.SignTransactionExtended({
        	"address_handle_extended": address_handle_extended_data
        	,
            "transaction_data": bb
        });
// 		console.log("txContents: " + JSON.stringify(txContents));
        
        tempBuffer = txContents.encode();
        
        
        var tempTXstring = tempBuffer.toString('hex');
//         document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
        // 	console.log("txSize = " + txSize);
        // 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
        // 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0065"; // extended
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        
        if(currentCommand == 'signAndSend')
        {
        	tempTXglobal = tempTXstring;
        	setChangeAddress(usechange);
//         	app.sliceAndWrite64(tempTXglobal);
        }else{
			document.getElementById("device_signed_transaction").value = tempTXstring;
			$("#sign_transaction_with_device").attr('disabled',false);
			console.log("READY");
			app.displayStatus('About to set change');
        	setChangeAddress(usechange);
			app.displayStatus('Ready to sign');
        	
		}
        

    }

	
////////////////////////////
// Send QR code request
// Will only display from the receive chain and must be handed the index not the full address.
////////////////////////////

    var requestQRdisplay = function(address_handle_index) 
    {
        var ProtoBuf = dcodeIO.ProtoBuf;
        var ByteBuffer = dcodeIO.ByteBuffer;
        var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
            Device = builder.build();

        var txContents = new Device.DisplayAddressAsQR({
        	"address_handle_index": address_handle_index
        });
        
        
        tempBuffer = txContents.encode();
        
        
        var tempTXstring = tempBuffer.toString('hex');
//         document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
        // 	console.log("txSize = " + txSize);
        // 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
        // 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0080";
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        app.sliceAndWrite64(tempTXstring);
    }


////////////////////////////
// Send set change address for transaction to follow
// Will only use from the change chain and must be handed the index not the full address.
////////////////////////////

    var setChangeAddress = function(address_handle_index) 
    {
        var ProtoBuf2 = dcodeIO.ProtoBuf;
//         var ByteBuffer = dcodeIO.ByteBuffer;
        var builder2 = ProtoBuf2.loadProtoFile("libs/bitlox/messages.proto"),
            Device2 = builder2.build();

        var txContents2 = new Device2.SetChangeAddressIndex({
        	"address_handle_index": address_handle_index
        });
        
        
        var tempBuffer = txContents2.encode();
        
        
        var tempTXstring = tempBuffer.toString('hex');
//         document.getElementById("temp_results").innerHTML = tempTXstring;
        txSize = d2h((tempTXstring.length) / 2).toString('hex');
        // 	console.log("txSize = " + txSize);
        // 	console.log("txSize.length = " + txSize.length);
        var j;
        var txLengthOriginal = txSize.length;
        for (j = 0; j < (8 - txLengthOriginal); j++) {
            var prefix = "0";
            txSize = prefix.concat(txSize);
        }
        // 	console.log("txSizePadded = " + txSize);
        tempTXstring = txSize.concat(tempTXstring);

        var command = "0066";
        tempTXstring = command.concat(tempTXstring);

        var magic = "2323"
        tempTXstring = magic.concat(tempTXstring);
        app.displayStatus('Setting change address');

        app.sliceAndWrite64(tempTXstring);
    }



    var sendTransactionForSigning = function() {
        var preppedForDevice = document.getElementById("device_signed_transaction").value;
        // 	console.log("send to device = " + preppedForDevice);
        autoCannedTransaction(preppedForDevice);
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    // PROTOBUF (end)
    ///////////////////////////////////////////////////////////////////////////////////////



    var deviceCommands = {
        ping: '23230000000000070A0548656C6C6F',
        format_storage: '2323000D000000220A204242424242424242424242424242424242424242424242424242424242424242',
        button_ack: '2323005100000000',
        button_cancel: '2323005200000000',
        pin_cancel: '2323005500000000',
        otp_cancel: '2323005800000000',
		GetAllWallets: '2323008100000000',

        list_wallets: '2323001000000000',

        scan_wallet: '2323006100000000',

        load_wallet:    '2323000B00000000',
        load_wallet_0:  '2323000B000000020800',
        load_wallet_1:  '2323000B000000020801',
        load_wallet_2:  '2323000B000000020802',
        load_wallet_3:  '2323000B000000020803',
        load_wallet_4:  '2323000B000000020804',
        load_wallet_5:  '2323000B000000020805',
        load_wallet_6:  '2323000B000000020806',
        load_wallet_7:  '2323000B000000020807',
        load_wallet_8:  '2323000B000000020808',
        load_wallet_9:  '2323000B000000020809',
        load_wallet_10: '2323000B00000002080A',
        load_wallet_11: '2323000B00000002080B',
        load_wallet_12: '2323000B00000002080C',
        load_wallet_13: '2323000B00000002080D',
        load_wallet_14: '2323000B00000002080E',
        load_wallet_15: '2323000B00000002080F',
        load_wallet_16: '2323000B000000020810',
        load_wallet_17: '2323000B000000020811',
        load_wallet_18: '2323000B000000020812',
        load_wallet_19: '2323000B000000020813',
        load_wallet_20: '2323000B000000020814',
        load_wallet_21: '2323000B000000020815',
        load_wallet_22: '2323000B000000020816',
        load_wallet_23: '2323000B000000020817',
        load_wallet_24: '2323000B000000020818',
        load_wallet_25: '2323000B000000020819',

        delete_wallet_0: '23230016000000020800',
        delete_wallet_1: '23230016000000020801',
        delete_wallet_2: '23230016000000020802',
        delete_wallet_3: '23230016000000020803',
        delete_wallet_4: '23230016000000020804',
        delete_wallet_5: '23230016000000020805',

        get_entropy_4096_bytes: '2323001400000003088020',
        get_entropy_32_bytes: '23230014000000020820',
        reset_lang: '2323005900000000',
        get_device_uuid: '2323001300000000',
        features: '2323003A00000000',
        deadbeef: '7E7E'
    };





	var walletsListForPicker =[];
	var walletNameListForPicker = [];


    function processResults(command, length, payload) {
            var ProtoBuf = dcodeIO.ProtoBuf;
            var ByteBuffer = dcodeIO.ByteBuffer;
            var builder = ProtoBuf.loadProtoFile("libs/bitlox/messages.proto"),
                Device = builder.build();

// 			console.log("RX: " + command);
            command = command.substring(2, 4)
//  			window.plugins.toast.show('to process: ' + command, 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
            console.log('to process: ' + command + ' ' + length + ' ' + payload);
            switch (command) {
                case "3A": // initialize
//                     var featuresMessage = Device.Features.decodeHex(payload);
//                     console.log("vendor: " + featuresMessage.vendor);
//                     console.log("config: " + featuresMessage.config);
//                     console.log("device name: " + featuresMessage.device_name);
// 					document.getElementById("device_name").innerHTML = featuresMessage.device_name;
                    break;

                case "30": // public address
                    ecdsa = payload.substring(8, 74);
                    // 					ecdsa = payload.substring(8,138); //uncompressed
                    // 					console.log('ecdsa from device ' + ecdsa);
                    document.getElementById("ecdsa").innerHTML = ecdsa;
                    ripe160of2 = payload.substring(78, 118);
                    // 					ripe160of2 = payload.substring(142,182);
                    document.getElementById("ripe160of2").innerHTML = ripe160of2;
                    // 					console.log('RIPE from device ' + ripe160of2);
                    pub58 = ecdsaToBase58(ecdsa);
                    document.getElementById("address_58").innerHTML = pub58;
                    break;

                case "31": // number of addresses in loaded wallet
                    numberOfAddresses = payload.substring(2, 4);
                    // 					console.log('# of addresses ' + numberOfAddresses);
                    document.getElementById("numberOfAddresses").innerHTML = numberOfAddresses;
                    break;

                case "32": // Wallet list
                    var walletMessage = Device.Wallets.decodeHex(payload);
					walletsListForPicker = [];
					walletNameListForPicker = [];
							
                    console.log("number of wallets: " + walletMessage.wallet_info.length);
                    var walletsIndex;
                    for (walletsIndex=0; walletsIndex < walletMessage.wallet_info.length; walletsIndex++){
						walletsListForPicker.push({ text: walletMessage.wallet_info[walletsIndex].wallet_name.toString("utf8"), value: walletMessage.wallet_info[walletsIndex].wallet_number });
						walletNameListForPicker.push(walletMessage.wallet_info[walletsIndex].wallet_name.toString("utf8"));
						console.log("wallet structure number: " + walletMessage.wallet_info[walletsIndex].wallet_number);
						console.log("wallet structure name: " + walletMessage.wallet_info[walletsIndex].wallet_name.toString("utf8"));
						console.log("wallet structure uuid: " + walletMessage.wallet_info[walletsIndex].wallet_uuid.toString("hex"));
						console.log("wallet version: " + walletMessage.wallet_info[walletsIndex].version);
                    }

                	var securedWallet = ''
                    $("#wallet_table").find("tr").remove();
                    var walletDataArray = "";
                    walletDataArray = walletMessage.wallet_info;
                    var index;
                    for (index = 0; index < walletDataArray.length; index++) {
                    	if(	walletMessage.wallet_info[index].version == 3)
                    	{
                    		securedWallet = '<span class="glyphicon glyphicon-lock h5"></span>&nbsp;'
                    	}
                        var wallet_number = walletMessage.wallet_info[index].wallet_number;
                        var wallet_name = walletMessage.wallet_info[index].wallet_name.toString("utf8");
                        var row = '<tr id="wallet_' + wallet_number + '" class="wallet_row" data-number="'+ wallet_number +'" data-name="'+ wallet_name +'"><td class="iterator hidden" ></td><td class="address-field" id="name_' + wallet_number + '" style="cursor:pointer">' + securedWallet + '   ' + wallet_name +'</td></tr>';
//                         var row = '<tr id="wallet_' + wallet_number + '" ><td class="iterator" >' + wallet_number + '</td><td class="address-field" id="name_' + wallet_number + '" style="cursor:pointer">' + securedWallet + wallet_name +'</td></tr>';
                        $('#wallet_table').append(row);
                        securedWallet = '';
                    }
                    $("#sign_transaction_with_device").attr('disabled',true);
                    $("#rawSubmitBtn").attr('disabled',true);
                    $("#renameWallet").attr('disabled',true);
                    $("#sendButton").attr('disabled',true);
                    $("#receiveButton").attr('disabled',true);
                    $("#signMessageButton").attr('disabled',true);
                    $("#transactionHistoryButton").attr('disabled',true);
                    $('#list_wallets').attr('disabled',false);
					$('.wallet_row').attr('disabled',false);
                    $("#newWalletButton").attr('disabled',false);
                    
                    app.displayStatus('Wallets listed');
                    currentCommand = '';
                    break;

                case "33": // Ping response
                    var PingResponse = Device.PingResponse.decodeHex(payload);
                    console.log(PingResponse);
                    console.log('echo: ' + PingResponse.echoed_greeting + ' session ID: ' + PingResponse.echoed_session_id);
                    break;
                case "34": // success
                	switch (currentCommand) {
						case "deleteWallet":
							app.displayStatus('Wallet deleted');
							$('#myTab a[href="#bip32"]').tab('show');
		  
							window.plugins.toast.show('Refreshing your wallet list', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
							$('#helpBlock').text('Click the wallet name and enter the PIN on your BitLox');
			
							app.sliceAndWrite64(deviceCommands.list_wallets);

							app.displayStatus('Listing wallets');
							currentCommand = '';
							break;
						case "renameWallet":
							app.displayStatus('Wallet renamed');
							$('#myTab a[href="#bip32"]').tab('show');
		  
							window.plugins.toast.show('Refreshing your wallet list', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
							$('#helpBlock').text('Click the wallet name and enter the PIN on your BitLox');
			
							app.sliceAndWrite64(deviceCommands.list_wallets);
        					$('#renameWallet').attr('disabled',false);

							app.displayStatus('Listing wallets');
							currentCommand = '';
							break;
						case "newWallet":		  
							window.plugins.toast.show('Refreshing your wallet list', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
							
							$('#helpBlock').text('Click the wallet name and enter the PIN on your BitLox');
							pausecomp(15000);
							app.sliceAndWrite64(deviceCommands.list_wallets);

							app.displayStatus('Listing refreshed');

							currentCommand = '';
							break;
						case "formatDevice":		  
							window.plugins.toast.show('Format successful', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
							app.displayStatus('Ready');
							app.sliceAndWrite64(deviceCommands.list_wallets);
							$('#myTab a[href="#bip32"]').tab('show');
							currentCommand = '';
							break;
						case "loadWallet":		  
							window.plugins.toast.show('Wallet loaded', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
							document.getElementById("transactionDisplayList").innerHTML = '';
							document.getElementById("balance_display").innerHTML = '';
							document.getElementById("payment_title").value = '';
							document.getElementById("receiver_address").value = ''; 
							document.getElementById("receiver_monies").value = '';
							document.getElementById("output_transaction").value = '';
							document.getElementById("rawTransaction").value = '';
							document.getElementById("device_signed_transaction").value = '';
							$("#rawTransactionStatus").addClass('hidden');
							$('#myTab a[href="#walletDetail"]').tab('show');
							app.displayStatus('Waiting for data');
            				app.sliceAndWrite64(deviceCommands.scan_wallet);
                    		$("#renameWallet").attr('disabled',false);
                    		$("#newWalletButton").attr('disabled',false);
                    		$(".wallet_row").attr('disabled',false);
                    		$('#list_wallets').attr('disabled',false);
// 							$('#forceRefresh').attr('disabled',true);
							$('#transactionDisplayListHeading').attr('hidden',true);

							currentCommand = '';
							break;
						case "signAndSend":
							app.sliceAndWrite64(tempTXglobal);
							tempTXglobal = '';
// 							currentCommand = '';
							break;
						default:
							app.displayStatus('Success');
							break;
                	}
						                	
                    break;
                    
                case "35": // general purpose error/cancel
                    var Failure = Device.Failure.decodeHex(payload);
//                     console.log(Failure);
//                     console.log('error #: ' + Failure.error_code + ' error: ' + Failure.error_message);
					$('#myTab a[href="#bip32"]').tab('show');
 					window.plugins.toast.show('error: ' + hex2a(payload), 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
 					
                	switch (currentCommand) {
						case "deleteWallet":
// 							app.displayStatus('Wallet deleted');
// 							$('#myTab a[href="#bip32"]').tab('show');
// 		  
// 							window.plugins.toast.show('Refreshing your wallet list', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
// 							$('#helpBlock').text('Click the wallet name and enter the PIN on your BitLox');
// 			
// 							app.sliceAndWrite64(deviceCommands.list_wallets);
// 
// 							app.displayStatus('Listing wallets');
							currentCommand = '';
							break;
						case "renameWallet":
// 							app.displayStatus('Wallet renamed');
// 							$('#myTab a[href="#bip32"]').tab('show');
// 		  
// 							window.plugins.toast.show('Refreshing your wallet list', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
// 							$('#helpBlock').text('Click the wallet name and enter the PIN on your BitLox');
// 			
// 							app.sliceAndWrite64(deviceCommands.list_wallets);
//         					$('#renameWallet').attr('disabled',false);
// 
// 							app.displayStatus('Listing wallets');
							currentCommand = '';
							break;
						case "newWallet":		  
// 							window.plugins.toast.show('Refreshing your wallet list', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
// 							
// 							$('#helpBlock').text('Click the wallet name and enter the PIN on your BitLox');
// 							pausecomp(15000);
// 							app.sliceAndWrite64(deviceCommands.list_wallets);
// 
// 							app.displayStatus('Listing refreshed');
// 
							currentCommand = '';
							break;
						case "formatDevice":		  
// 							window.plugins.toast.show('Format successful', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
// 							app.displayStatus('Ready');
// 							app.sliceAndWrite64(deviceCommands.list_wallets);
// 							$('#myTab a[href="#bip32"]').tab('show');
							currentCommand = '';
							break;
						case "loadWallet":		  
                    		$("#newWalletButton").attr('disabled',false);
                    		$(".wallet_row").attr('disabled',false);
                    		$('#list_wallets').attr('disabled',false);
							document.getElementById("loaded_wallet_name").innerHTML = '';

							currentCommand = '';
							break;
						default:
// 							app.displayStatus('Error');
							break;
                	}
 					
                   	break;
                    
                case "36": // device uuid return
                    var DeviceUUID = Device.DeviceUUID.decodeHex(payload);
                    console.log('device uuid: ' + DeviceUUID.device_uuid.toString("hex"));
                    break;
                    
                case "37": // entropy return
                    var Entropy = Device.Entropy.decodeHex(payload);
                    console.log('ReturnedEntropy: ' + Entropy.entropy);
                    break;
                    
                case "39": // signature return [original]
                    var Signature = Device.Signature.decodeHex(payload);
                    // 					Signature.signature_data
                    break;
                
                case "50": // #define PACKET_TYPE_ACK_REQUEST			0x50
					app.sliceAndWrite64(deviceCommands.button_ack);
                    break;
                    
                case "56": // #define PACKET_TYPE_OTP_REQUEST			0x56
					app.displayStatus('OTP');
					respondToOTPrequest();
                    break;
                    
                case "62": // parse & insert xpub from current wallet //RETURN from scan wallet
					var CurrentWalletXPUB = Device.CurrentWalletXPUB.decodeHex(payload);

					document.getElementById("bip32_source_key").textContent = CurrentWalletXPUB.xpub;

					var source_key = $("#bip32_source_key").val();
					useNewKey(source_key);
					app.displayStatus('xpub received');
// 					$("#sendButton").attr('disabled',false);
// 					$("#receiveButton").attr('disabled',false);
// 					$("#signMessageButton").attr('disabled',false);
// 					$("#transactionHistoryButton").attr('disabled',false);
                    break;
                    
                case "64": // signature return
                    var SignatureComplete = Device.SignatureComplete.decodeHex(payload);
// 					console.log("SignatureComplete: " + SignatureComplete.signature_complete_data);
//                  console.log("number of signatures: " + SignatureComplete.signature_complete_data.length);
                    var sigIndex;
                    var unSignedTransaction = document.getElementById("output_transaction").value;
// 					console.log("unSignedTransaction pre: " + unSignedTransaction);
                    
                    for (sigIndex=0; sigIndex < SignatureComplete.signature_complete_data.length; sigIndex++){
                    
                    	var payloadSig = SignatureComplete.signature_complete_data[sigIndex].signature_data_complete.toString("hex");
                    	var payloadSigSizeHex = payloadSig.substring(0, 2);
                    	var payloadSigSizeDec = h2d(payloadSigSizeHex);
                    	var payloadSigSizeChars = 2 + (payloadSigSizeDec * 2);
// 						console.log("SignatureComplete:Data:signature_data_complete " + sigIndex + "  SIZE (HEX) " + payloadSigSizeHex + "  SIZE (DEC) " + payloadSigSizeDec);
// 						console.log("SignatureComplete:Data:signature_data_complete RAW " + sigIndex + " " + payloadSig);
						payloadSig = payloadSig.substring(0, payloadSigSizeChars);
// 						console.log("SignatureComplete:Data:signature_data_complete TRIM " + sigIndex + " " + payloadSig);
						var scriptPrefix = "19";
						var script = scriptPrefix.concat(scriptsToReplace[sigIndex]);

// 						console.log("script to replace: " + script);
// 						console.log("unSignedTransaction: " + unSignedTransaction);

						unSignedTransaction = unSignedTransaction.replace(script, payloadSig);
// 						console.log("SignatureComplete:Data:signature_data_complete part SIGNED " + sigIndex + " " + unSignedTransaction);
                    }
// 					console.log("SignatureComplete:Data:signature_data_complete SIGNED " + unSignedTransaction);
//                     document.getElementById("ready_to_transmit").textContent = unSignedTransaction;
                    app.displayStatus('Signature received');

                    if(currentCommand == 'signAndSend')
                    {
                        app.displayStatus('Submitting...');
                    	rawSubmitAuto(unSignedTransaction);
                    }else
                    {
						document.getElementById("rawTransaction").value = unSignedTransaction;
						$("#signedtxlabel").show()
						$("#rawSubmitBtn").attr('disabled',false);
                    }
                    
                    break;

                case "71": // message signing return
                	console.log("########## in case 71 ###########");
 					window.plugins.toast.show('Processing signature', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
                    var SignatureMessage = Device.SignatureMessage.decodeHex(payload);
                    
                    var data_size = (SignatureMessage.signature_data_complete.toString("hex").length)/2;
                    var data_size_hex = d2h(data_size);

					console.log("SigMsg signature_data length: " + data_size_hex);
					console.log("SigMsg signature_data hex: " + SignatureMessage.signature_data_complete.toString("hex"));

					var SigByteArrayHex = Crypto.util.hexToBytes(SignatureMessage.signature_data_complete.toString("hex"));

					var compressed = true;
					var addrtype = 0;
					var address = document.getElementById("sgAddr").value;
	    			var message = document.getElementById("sgMsgHidden").value;
					
					var sig = sign_message_device_processing(message, address, SigByteArrayHex, compressed, addrtype);

					sgData = {"message":message, "address":address, "signature":sig};
					var sgType = 'inputs_io';
					
					$('#sgSig').val(makeSignedMessage(sgType, sgData.message, sgData.address, sgData.signature));
                    break;

                case "82": // bulk return
                	console.log("########## in case 82 ###########");
                    Bulk = Device.Bulk.decodeHex(payload);
                    
                    var data_size = (Bulk.bulk.toString("hex").length)/2;
                    var data_size_hex = d2h(data_size);

					BulkString = Bulk.bulk.toString("hex")
// 					console.log("Bulk.bulk raw: " + Bulk.bulk);
					console.log("Bulk.bulk length: " + data_size_hex);
// 					console.log("Bulk.bulk hex: " + BulkString);
                    break;

                default:
                	break;
            } //switch

        } //function processResults



    function compareRIPE160() {
        var areEqual = dev.toUpperCase() === calc.toUpperCase();
        if (areEqual) {
            document.getElementById("RIPEDEVICE").addClass("has-success has-feedback");
        }
    }
 
 
    
    var tempRIPECALC;

    function ecdsaToBase58(publicKeyHex) {
        //could use publicKeyBytesCompressed as well
        var hash160 = Crypto.RIPEMD160(Crypto.util.hexToBytes(Crypto.SHA256(Crypto.util.hexToBytes(publicKeyHex))))

        document.getElementById("ripe160of2_CALC").innerHTML = hash160.toUpperCase();

        var version = 0x00 //if using testnet, would use 0x6F or 111.
        var hashAndBytes = Crypto.util.hexToBytes(hash160)
        hashAndBytes.unshift(version)

        var doubleSHA = Crypto.SHA256(Crypto.util.hexToBytes(Crypto.SHA256(hashAndBytes)))
        var addressChecksum = doubleSHA.substr(0, 8)
            // 		console.log(addressChecksum) //26268187

        var unencodedAddress = "00" + hash160 + addressChecksum

        // 		console.log(unencodedAddress)
        /* output
		  003c176e659bea0f29a3e9bf7880c112b1b31b4dc826268187
		*/

        var address = Bitcoin.Base58.encode(Crypto.util.hexToBytes(unencodedAddress))
            // 		console.log("Address58 " + address) //16UjcYNBG9GTK4uq2f7yYEbuifqCzoLMGS
        return address;
    }

    function makeListItems(theList, theID, theContent, theCount, theStart) {
        var myItems = [];
        var myList = $(theList);
        var myContent = theContent;
        var myID = theID;
        var myCount = theCount;
        var myStart = theStart;
        for (var i = myStart; i < myCount; i++) {
            myItems.push("<li><a href=\"#\" id=\"" + myID + "" + i + "\">" + myContent + " " + i + "</a></li>");
            // 			myItems.push( "<li id=\"" + myID + "" + i + "\">" +  myContent + " " + i + "</li>" );

        }

        myList.append(myItems.join(""));
    }

    function loadWalletNames() {
        app.sliceAndWrite64(deviceCommands.list_wallets);
    }


    function autoCannedTransaction(transData) {
    	app.sliceAndWrite64(transData);
//         chunkSize = 32;
//         var chunkedTData = [];
//         var tempDTS = '';
//         tempDTS = transData;
// //         console.log('Size of transData : ' + tempDTS.length);
//         var transDataRemainder = tempDTS.length % 16;
// //         console.log('Remainder : ' + transDataRemainder);
//         if(transDataRemainder==0||transDataRemainder==12||transDataRemainder==14){
// 			var prepend = '00000000';
// 			tempDTS = prepend.concat(tempDTS);
// 		}			
// //         console.log('tempDTS : ' + tempDTS);
//         chunkedTData = tempDTS.chunk(chunkSize);
// //         console.log('Number of chunks : ' + chunkedTData.length);
//         for (i = 0; i < (chunkedTData.length - 1); i++) {
//             dataToSend = chunkedTData[i];
//             sendToDevice = '00' + dataToSend;
//             var txResult = device.hid_write(sendToDevice);
// //             console.log('HID TX : ' + sendToDevice);
// //             console.log('HID TX size: ' + txResult);
//             pausecomp(50);
//         }
// 
//         dataToSend = chunkedTData[chunkedTData.length - 1];
// //         console.log('dataToSend.length: ' + dataToSend.length); 
// 		sendToDevice = '00' + dataToSend + '7E7E';
// 		var txResult = device.hid_write(sendToDevice);
// // 		console.log('HID TX : ' + sendToDevice);
// // 		console.log('HID TX size: ' + txResult);
    }




    ///////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////
    // BIP32/Bitcoin SPECIFIC 
    ///////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////


/**
*	Variables
*/
    var MAINNET_PUBLIC = 0x0488b21e;
    var MAINNET_PRIVATE = 0x0488ade4;
    var TESTNET_PUBLIC = 0x043587cf;
    var TESTNET_PRIVATE = 0x04358394;

    var RECEIVE_CHAIN = 0;
    var CHANGE_CHAIN = 1;
	var addressToNextDisplay = '';
	var indexToNextDisplay = 0;
// ROLLING
    var GAP = 3; // how many extra addresses to generate

    var key = null;
    var network = null;
    var addresses = {
        "receive": {},
        "change": {}
    };;
    var balance = 0;
    var pending = 0;
    var unspent = {};
    var lastone = {
        "receive": GAP,
        "change": GAP
    };
    var chains = {
        "receive": null,
        "change": null
    };
    var usechange = 0;

    var clearData = function() {
        key = null;
        network = null;
        addresses = {
            "receive": {},
            "change": {}
        };
        balance = 0;
        pending = 0;
        unspent = {};
        lastone = {
            "receive": GAP,
            "change": GAP
        };
        chains = {
            "receive": null,
            "change": null
        };
        usechange = 0;

        $("#receive_table").find("tr").remove();
        $("#change_table").find("tr").remove();
        $("#balance_display").html('<span class="glyphicon glyphicon-refresh spinning"></span>');
    }

    var ops = Bitcoin.Opcode.map;




    //------------
    // From https://gist.github.com/paolorossi/5747533
    function Queue(handler) {
            var queue = [];

            function run() {
                var callback = function() {
                        queue.shift();
                        // when the handler says it's finished (i.e. runs the callback)
                        // We check for more tasks in the queue and if there are any we run again
                        if (queue.length > 0) {
                            run();
                        }
                    }
                    // give the first item in the queue & the callback to the handler
                handler(queue[0], callback);
            }

            // push the task to the queue. If the queue was empty before the task was pushed
            // we run the task.
            this.append = function(task) {
                queue.push(task);
                if (queue.length === 1) {
                    run();
                }
            }
        }
        
        
        
	// small handler that launch task and calls the callback
	// when its finished
    var queue = new Queue(function(task, callback) {
        task(function() {
            // call an option callback from the task
            if (task.callback)
                task.callback();
            // call the buffer callback.
            callback();
        });
    });

//     var queueInverse = new Queue(function(task, callback) {
//         return task(function() {
//             // call the buffer callback.
//             callback();
//             // call an option callback from the task
//             if (task.callback)
//                 task.callback();
//         }).done(console.log('done balances updating'));
//     });



    var getAddr = function(key) {
        var hash160 = key.eckey.getPubKeyHash();
        var addr = new Bitcoin.Address(hash160);
        addr.version = 0x6f; // testnet
        return addr.toString();
    }



    var generate = function() {
        for (var i = 0; i < 12; i++) {
            c = b.derive_child(i);
            childs.push(c);
            addresses.push(getAddr(c));
            $("#results").append(getAddr(c) + "<br>");
        }
    }



    var hashFromAddr = function(string) {
        var bytes = Bitcoin.Base58.decode(string);
        var hash = bytes.slice(0, 21);
        var checksum = Crypto.SHA256(Crypto.SHA256(hash, {
            asBytes: true
        }), {
            asBytes: true
        });

        if (checksum[0] != bytes[21] ||
            checksum[1] != bytes[22] ||
            checksum[2] != bytes[23] ||
            checksum[3] != bytes[24]) {
            throw "Checksum validation failed!";
        }

        this.version = hash.shift();
        this.hash = hash;
        return hash;
    }



    var createOutScript = function(address) {
        var script = new Bitcoin.Script();
        script.writeOp(ops.OP_DUP);
        script.writeOp(ops.OP_HASH160);
        script.writeBytes(hashFromAddr(address));
        script.writeOp(ops.OP_EQUALVERIFY);
        script.writeOp(ops.OP_CHECKSIG);
        return script;
    }



    var valueFromNumber = function(number) {
        var value = BigInteger.valueOf(number * 1e8);
        value = value.toByteArrayUnsigned().reverse();
        while (value.length < 8) value.push(0);
        return value;
    }



    var valueFromSatoshi = function(number) {
        var value = BigInteger.valueOf(number);
        value = value.toByteArrayUnsigned().reverse();
        while (value.length < 8) value.push(0);
        return value;
    }



    var valueFromInteger = function(number) {
        var value = BigInteger.valueOf(number);
        value = value.toByteArrayUnsigned().reverse();
        while (value.length < 4) value.push(0);
        return value;
    }



    var parseScriptString = function(scriptString) {
        var opm = Bitcoin.Opcode.map;
        var inst = scriptString.split(" ");
        var bytescript = [];
        for (thisinst in inst) {
            var part = inst[thisinst];
            if ("string" !== typeof part) {
                continue;
            }
            if ((part.length > 3) && (part.slice(0, 3) == 'OP_')) {
                for (name in opm) {
                    if (name == part) {
                        bytescript.push(opm[name])
                    }
                }
            } else if (part.length > 0) {
                bytescript.push(Bitcoin.Util.hexToBytes(part));
            }
        }
        return bytescript;
    };





    var noUpdate = function(addr) {
        return function(jqXHR, textStatus, errorThrown) {
            if (jqXHR.status != 500) {
                console.log(errorThrown);
            } else {
                $("#" + addr).children(".balance").text(0);
                $("#" + addr).children(".pending").text(0);
            }
        }
    }


    var gotUnspent = function(chain, index, addr) {
        return function(data, textStatus, jqXHR) {
        	console.log("chain " + chain);
        	console.log("index " + index);
        	console.log("addr " + addr);
//         	alert("addr " + addr);
			if(chain === "receive"){
				chain_numerical = 0;
				}
				else
				{
				chain_numerical = 1;
				}
//             unspent[addr] = data.unspent_outputs;
            unspent[addr] = data;
//             confirmations[addr] = data.confirmations;
            thisbalance = 0;
            thispending = 0;

            for (var x = 0; x < unspent[addr].length; x++) {
//             alert(unspent[addr][x].confirmations);
                if (unspent[addr][x].confirmations === 0) {											//fix this to withhold unconfirmed
                    thispending += unspent[addr][x].amount * 100000000;     
					unspent[addr][x].chain = chain_numerical;
					unspent[addr][x].index = index;
                } else {
                    thisbalance += unspent[addr][x].amount * 100000000;
					unspent[addr][x].chain = chain_numerical;
					unspent[addr][x].index = index;
                }
            }
            balance += thisbalance;
            pending += thispending;
//             $("#balance_display").text(balance / 100000000); // Satoshi to BTC
// 			$("#pending_display").text(pending / 100000000); // Satoshi to BTC
//             $("#pending_display").innerHTML = '&nbsp;&nbsp;&nbsp;['+(pending / 100000000)+' <small>PENDING</small>]'; // Satoshi to BTC
            $("#" + addr).children(".balance").text(thisbalance / 100000000);
            $("#" + addr).children(".pending").text(thispending / 100000000);


            
//             for (var x = 0; x < unspent[addr].length; x++) {
//                 thisbalance += unspent[addr][x].value;
//                 unspent[addr][x].chain = chain_numerical;
//                 unspent[addr][x].index = index;
//             }
//             balance += thisbalance;
//             $("#balance_display").text(balance / 100000000); // Satoshi to mBTC
//             $("#" + addr).children(".balance").text(thisbalance / 100000000);
        };
    }




    var gotUnspentError = function(chain, index, addr) {
        return function(jqXHR, textStatus, errorThrown) {
            if (jqXHR.status != 500) {
                console.log(errorThrown);
            } else {
                $("#" + addr).children(".balance").text(0);
            }
        }
    }

    var checkReceived = function(chain, index, addr, callback) {
        return function(data, textStatus, jqXHR) {
        	console.log('check if EVER received funds on '+chain+' : '  + data);
        	app.displayStatus('Checking balances');
            if (parseInt(data) > 0) {
                var newlast = Math.max(index + GAP + 1, lastone[chain]);
//                 alert("newlast " + newlast);
                lastone[chain] = newlast;
                queue.append(generateAddress(chain, index + 1));
                

                if (chain === 'receive') {
                	indexToNextDisplay = index + 1;
//                 	alert("iTND "+indexToNextDisplay);
//                 	if (chains[chain]) {
// 						var childkey = chains[chain].derive_child(indexToNextDisplay);
// 						addressToNextDisplay = childkey.eckey.getBitcoinAddress().toString();
// //                 		alert("aTND " + indexToNextDisplay +" "+addressToNextDisplay);            
// 					}

                }
                if (chain === 'change') {
                    usechange = index + 1;
                }

                var jqxhr2 = $.get(baseUrl + '/addr/' + addr + '/utxo')
                    .done(gotUnspent(chain, index, addr))
                    .fail(gotUnspentError(chain, index, addr))
                    .always(function() {});
                callback();
            } else {

				$("#balance_display").html((balance / 100000000 ) + "<small> BTC</small>"); // Satoshi to BTC
				$("#" + addr).children(".balance").text(0);
				
				if(pending !== 0)
				{
					$("#pending_display").html((pending / 100000000) + "<small> PENDING</small>"); // Satoshi to BTC
				}else
				{
					$("#pending_display").html("");
				}
				$("#" + addr).children(".pending").text(0);

                if (index < lastone[chain] - 1) {
                    queue.append(generateAddress(chain, index + 1));
                }else{
        			if (chain === 'receive') {
						requestQRdisplay(indexToNextDisplay);
        			}
                }
                if (index === lastone[chain] - 1) {
					app.displayStatus('Finished balances');   
					$("#sendButton").attr('disabled',false);
					$("#receiveButton").attr('disabled',false);
					$("#signMessageButton").attr('disabled',false);
					$("#transactionHistoryButton").attr('disabled',false);
					$('#forceRefresh').attr('disabled',false);
					var theBalance = document.getElementById('balance_display').innerHTML;
					document.getElementById('payment_title').innerHTML = theBalance;
					$('#signAndSendStandard').attr('disabled',false);	
                }
                
                callback();

            }
        };
    }

    var updateBalance = function(chain, index, addr, callback) {
//         var jqxhr = $.get('https://blockchain.info/q/getreceivedbyaddress/' + addr ,{}, 'text')
        var jqxhr = $.get(serverURLio + '/addr/' + addr + '/totalReceived',{}, 'text') // does not return the amount if not confirmed
            .done(checkReceived(chain, index, addr, callback));
    }
// https://blockchain.info/q/getreceivedbyaddress/17XLaSzT7ZpzEJmFvnqEFycoEUXDaXkPcp


	var addressListForMessages = [];
	var addressesMatrix = [];
	var addressesMatrixReceive = [];

    // Simple task to generate addresses and query them;
    var generateAddress = function(chain, index) {
        return function(callback) {
            if (chains[chain]) {
                var childkey = chains[chain].derive_child(index);
                var childaddr = childkey.eckey.getBitcoinAddress().toString();
                var childFront = childaddr.slice(0,17);
                var childBack = childaddr.slice(18,36);

                addressesMatrix.push(childaddr);

                var qrcode = ''
                var qrcode2 = ''
                if (chain === 'receive') {
                    qrcode = ' <br><span class="open-qroverlay glyphicon glyphicon-qrcode glyphicon-qrcode-big" data-toggle="modal" data-target="#qroverlay" data-addr="' + childaddr + '"></span>';
                    qrcode2 = ' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="open-sendMsgFrom glyphicon glyphicon-envelope" data-target="#signMessageTab" data-addr="' + childaddr + '" data-index="' + index + '" data-chain="' + chain + '"></span>';
                    addressListForMessages.push({ text: childaddr, value: index });
                    addressesMatrixReceive.push(childaddr);
                }
//                 var row = '<tr id="' + childaddr + '"><td class="iterator">' + index + '</td><td class="address-field">' + '<a href="http://bitlox.io/address/' + childaddr + '" target="_system">' + childFront +'<br>'+ childBack + '</a>' + qrcode + qrcode2 + '</td><td class="balance">?</td></tr>';
                var row = '<tr id="' + childaddr + '"><td class="iterator">' + index + '</td><td class="address-field">' + ' <span class="selectable">' + childFront +'<br>'+ childBack + '</span>' + qrcode + qrcode2 + '</td><td class="balance">?</td>[<td class="pending">?</td>]</tr>';
                $('#' + chain + '_table').append(row);
                addresses[chain][childaddr] = childkey;

                if (navigator.onLine) {
                    updateBalance(chain, index, childaddr, callback);
                } else {
                    if (index < lastone[chain] - 1) {
                        queue.append(generateAddress(chain, index + 1));
                    }
                    callback();
                }

            } else {
                callback();
            }
        }
    }






    var genTransaction = function() {
        if (balance > 0) {
            var receiver = $("#receiver_address").val();
            var amountPrep = $("#receiver_monies").val();
//             alert("amountPrep " + amountPrep);
            amountPrep = amountPrep.replace(/[^\d\.]/g, "" );
//             alert("amountPrepregex " + amountPrep);
			var zeroText = "0";
            amountPrep = zeroText.concat(amountPrep);
//             alert("amountPrepconcat " + amountPrep);
            var amount = Math.ceil(parseFloat(amountPrep) * 100000000);
//             alert("amount " + amount);
            
//             var amount = Math.ceil(parseFloat($("#receiver_monies").val()) * 100000000);
            var fee = Math.ceil(parseFloat($("#fee_monies").val()) * 100000000);
            if (!(amount > 0)) {
                console.log("Nothing to do");
            }
            if (!(fee >= 0)) {
                fee = 0;
            }
            var target = amount + fee;
            if (target > balance) {
                alert("Not enough funds available");
                return
            } else {
                // prepare inputs
                var fullInputTransactionHash = [];
                var fullInputTXindex = [];
                var address_handle_chain = [];
                var address_handle_index = [];
// 				var scriptsToReplace = [];

                var incoin = [];
                for (var k in unspent) {
                    var u = unspent[k];
                    for (var i = 0; i < u.length; i++) {
                        var ui = u[i]
                        var coin = {
                            "hash": ui.txid,
                            "age": ui.confirmations,
                            "address": k,
                            "coin": ui,
                            "chain": ui.chain,
                            "index": ui.index
                        };
            			console.log("address: " + coin.address);
//             			console.log("coin: " + coin.coin);
            			console.log("chain: " + coin.chain);
            			console.log("index: " + coin.index);
                        incoin.push(coin);
                    }
                }
                var sortcoin = _.sortBy(incoin, function(c) {
                    return c.age;
                });

                inamount = 0;
                var tx = new Bitcoin.Transaction();

                var toaddr = new Bitcoin.Address(receiver);
                var to = new Bitcoin.TransactionOut({
                    value: valueFromSatoshi(amount),
                    script: Bitcoin.Script.createOutputScript(toaddr)
                });
                tx.addOutput(to);
                // add in the hooks to the + button here
                
                

                var usedkeys = [];
                for (var i = 0; i < sortcoin.length; i++) {
                    var coin = sortcoin[i].coin;
                    var tin = new Bitcoin.TransactionIn({
                        outpoint: {
                            hash: Bitcoin.Util.bytesToBase64(Bitcoin.Util.hexToBytes(coin.txid).reverse()), //  .reverse()!
                            index: coin.vout
                        },
                        script: Bitcoin.Util.hexToBytes(coin.scriptPubKey),
                        sequence: 4294967295
                    });
					scriptsToReplace[i] = coin.scriptPubKey;
                    fullInputTransactionHash[i] = Bitcoin.Util.bytesToHex(Bitcoin.Util.hexToBytes(coin.txid));  // no .reverse()!
//             		alert("fullInputTransactionHash[" + i + "]: " + fullInputTransactionHash[i]);
                    fullInputTXindex[i] = coin.vout;
                    address_handle_chain[i] = coin.chain;
                    address_handle_index[i] = coin.index;

                    tx.addInput(tin);
                    inamount += coin.amount * 100000000;
                    usedkeys.push(sortcoin[i].address);

                    if (inamount >= target) {
                        break;
                    }
                }

                if (inamount > target) {
//                 ROLLING
                    var changeaddr = chains['change'].derive_child(usechange).eckey.getBitcoinAddress();
//                     var changeaddr = chains['receive'].derive_child(0).eckey.getBitcoinAddress();
                    var ch = new Bitcoin.TransactionOut({
                        value: valueFromSatoshi(inamount - target),
                        script: Bitcoin.Script.createOutputScript(changeaddr)
                    });
                    tx.addOutput(ch);
                }

                if (key.has_private_key) {
                    for (var i = 0; i < usedkeys.length; i++) {
                        k = usedkeys[i];
                        var inchain = null;
                        if (k in addresses['receive']) {
                            inchain = addresses['receive'];
                        } else if (k in addresses['change']) {
                            inchain = addresses['change'];
                        }
                        if (inchain) {
                            tx.signWithKey(inchain[k].eckey);
                        } else {
                            console.log("Don't know about all the keys needed.");
                        }
                    }
                    $("#signedtxlabel").show()
                    $("#unsignedtxlabel").hide()
                    $("#submit_signed_transaction").removeAttr('disabled');
                } else {
                    $("#unsignedtxlabel").show()
                    $("#signedtxlabel").hide()
                    $("#preptxlabel").show()
                    
                    $("#submit_signed_transaction").attr('disabled', true);
                }
                $("#output_transaction").val(Bitcoin.Util.bytesToHex(tx.serialize()));
                var unsignedTransactionToBeCoded = Bitcoin.Util.bytesToHex(tx.serialize());
                var fullInputTXHex = [];
                var how_many_inputs = fullInputTXindex.length;
                var mCounter = 0;
//                 alert("fullInputTXindex.length: " + how_many_inputs);

				$.each(fullInputTransactionHash, function(i, val){
// 					alert("in each: " + i + " " + val);

					$.get(baseUrl + '/rawtx/' + val)
						.done
						(
							function(data)
								{
// 									alert(data.rawtx);
// 									console.log("in each done: "  + data.rawtx + " i:" + i);
									fullInputTXHex[i] = data.rawtx;
									mCounter++;
									if(mCounter == how_many_inputs){prepForSigning(unsignedTransactionToBeCoded, fullInputTXHex, fullInputTXindex, address_handle_chain, address_handle_index)}
								}
						)
						.fail
						(
							function()
								{
									alert("failed to fetch data");
								}
						)
					} // end each function
				) // end each
                console.log("fullInputTXindex: " + fullInputTXindex);
                console.log("unsignedTransactionToBeCoded: " + unsignedTransactionToBeCoded);
				for(m=0; m < how_many_inputs; m++)
				{
                console.log("scripts to replace: " + scriptsToReplace[m]);
				}
                return tx;
            }
        }
    }
    
    


    var useNewKey = function(source_key) {
        var keylabel = "";
        var networklabel = "";
        clearData();

        try {
            key = new BIP32(source_key);
        } catch (e) {
            console.log(source_key);
            console.log("Incorrect key?");
        }
        if (key) {
            switch (key.version) {
                case MAINNET_PUBLIC:
                    keylabel = "Public key";
                    network = 'prod';
                    networklabel = "Bitcoin Mainnet";
                    break;
                case MAINNET_PRIVATE:
                    keylabel = "Private key";
                    network = 'prod';
                    networklabel = "Bitcoin Mainnet";
                    break;
                case TESTNET_PUBLIC:
                    keylabel = "Public key";
                    network = 'test';
                    networklabel = "Bitcoin Testnet";
                    break;
                case TESTNET_PRIVATE:
                    keylabel = "Private key";
                    network = 'test';
                    networklabel = "Bitcoin Testnet";
                    break;
                default:
                    key = null;
                    console.log("Unknown key version");
            }
            Bitcoin.setNetwork(network);
        }
        $("#bip32_key_info_title").text(keylabel);
        $("#network_label").text(networklabel);

        console.log("key depth: " + key.depth);
//         window.plugins.toast.show("key depth: " + key.depth, 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});

        if (key.depth != 1) {
            alert("Non-standard key depth: should be 1, and it is " + key.depth + ", are you sure you want to use that?");
        }

		addressListForMessages.length = 0;
		addressesMatrix.length = 0;
		addressesMatrixReceive.length = 0;

        chains["receive"] = key.derive_child(RECEIVE_CHAIN);
        chains["change"] = key.derive_child(CHANGE_CHAIN);

        queue.append(generateAddress("receive", 0),0);
        queue.append(generateAddress("change", 0),0);
//         queue.append(getTransactionHistory(0,25),0);
    };



    function onInput(id, func) {
        $(id).bind("input keyup keydown keypress change blur", function() {
            if ($(this).val() != jQuery.data(this, "lastvalue")) {
                func();
            }
            jQuery.data(this, "lastvalue", $(this).val());
        });
        $(id).bind("focus", function() {
            jQuery.data(this, "lastvalue", $(this).val());
        });
    };



    var onUpdateSourceKey = function() {
        var source_key = $("#bip32_source_key").val();
        useNewKey(source_key);
//         console.log('balances done');
//      app.displayStatus('Balances updated');
    };



    $(document).on("click", ".open-qroverlay", function() {
        var myAddress = $(this).data('addr');
        qrCopyAddress = myAddress;
        console.log("QR-->" + myAddress);
        $("#qraddr").text(myAddress);

        var qrCode = qrcode(5, 'H');
//         var text = "bitcoin:" + myAddress;
        var text = myAddress;
        text = text.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
        qrCode.addData(text);
        qrCode.make();
        $('#genAddrQR').html(qrCode.createImgTag(6));
    });

    $(document).on("click", "#addrCopy", function() {
		cordova.plugins.clipboard.copy(qrCopyAddress);
		window.plugins.toast.show('Copied to clipboard', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
		qrCopyAddress = '';
    });


    $(document).on("click", ".open-sendMsgFrom", function() {
        document.getElementById("sgMsg").value = '';
        document.getElementById("sgMsgHidden").value = '';
        document.getElementById("sgAddr").value = '';
        document.getElementById("sgRoot").value = '';
        document.getElementById("sgChain").value = '';
        document.getElementById("sgIndex").value = '';
        
        var myAddress = $(this).data('addr');
        var myRoot = 0;
        var myChainText = $(this).data('chain');
        var myChain = '';
        if(myChainText == "receive"){
        	myChain = 0;
		}
			else
		{
        	myChain = 1;
		}
        var myIndex = $(this).data('index');
        console.log("-->" + myAddress);
        console.log("-->" + myRoot);
        console.log("-->" + myChain);
        console.log("-->" + myIndex);
        
        document.getElementById("sgAddr").value = myAddress;
        document.getElementById("sgRoot").value = Number(myRoot);
        document.getElementById("sgChain").value = Number(myChain);
        document.getElementById("sgIndex").value = Number(myIndex);

		$('#myTab a[href="#sign"]').tab('show');
		$('html, body').animate({scrollTop:0}, 'slow');
    });


    var sendToMessageSigner = function(myIndex) {
        document.getElementById("sgSig").value = '';
        document.getElementById("sgMsg").value = '';
        document.getElementById("sgMsgHidden").value = '';
        document.getElementById("sgAddr").value = '';
        document.getElementById("sgRoot").value = '';
        document.getElementById("sgChain").value = '';
        document.getElementById("sgIndex").value = '';
        
        var myAddress = addressesMatrixReceive[myIndex];
//         alert(myAddress);
        var myRoot = 0;
//         var myChainText = $(this).data('chain');
        var myChain = 0;
 //        if(myChainText == "receive"){
//         	myChain = 0;
// 		}
// 			else
// 		{
//         	myChain = 1;
// 		}
//         var myIndex = $(this).data('index');
        console.log("-->" + myAddress);
        console.log("-->" + myRoot);
        console.log("-->" + myChain);
        console.log("-->" + myIndex);
        
        document.getElementById("sgAddr").value = myAddress;
        document.getElementById("sgRoot").value = Number(myRoot);
        document.getElementById("sgChain").value = Number(myChain);
        document.getElementById("sgIndex").value = Number(myIndex);

		$('#myTab a[href="#sign"]').tab('show');
		$('html, body').animate({scrollTop:0}, 'slow');
    };


 	function makePickerList()
	{
		var JSONObj = new Object();
		JSONObj = {
			title: "Select an address", 
			selectedValue: "",
			cancelButtonLabel: "Cancel",
			doneButtonLabel: "Select",
		};
		JSONObj.items = [];
		var i;	
		for(i=0; i < addressListForMessages.length; i++)
		{
			JSONObj.items.push(addressListForMessages[i]);
		} 	
		return JSONObj;
	}



	var signMessageAddressPicker = function(TheObject)
	{

		// Show the picker
		window.plugins.listpicker.showPicker(TheObject, 
			function(item) { 
				sendToMessageSigner(item);
			},
			function() { 
			}
		);
	}


	$('.signMessageClass').on('click', function() {
		event.preventDefault();
		signMessageAddressPicker(makePickerList());
	});
        
 	var makePickerListWallets = function ()
	{
		var JSONObjWallet = new Object();
		JSONObjWallet = {
			title: "Select a wallet", 
			selectedValue: "",
			cancelButtonLabel: "Cancel",
			doneButtonLabel: "Select",
		};
		JSONObjWallet.items = [];
		var i;	
		for(i=0; i < walletsListForPicker.length; i++)
		{
			JSONObjWallet.items.push(walletsListForPicker[i]);
		} 	
		return JSONObjWallet;
	}
 
        
	var deleteWalletPicker = function(TheObject)
	{

		// Show the picker
		window.plugins.listpicker.showPicker(TheObject, 
			function(item) { 
				directDeleteWallet(item);
			},
			function() { 
// 				alert("You have cancelled");
			}
		);
	}

	$('.address-from-select').on('click', function() {
		event.preventDefault();
		specificFromAddressPicker(makePickerList());
	});
        
	var specificFromAddressPicker = function(TheObject)
	{

		// Show the picker
		window.plugins.listpicker.showPicker(TheObject, 
			function(item) { 
				filterFromAddresses(item);
			},
			function() { 
			}
		);
	}

	var filterFromAddresses = function(index)
	{
		indexToBeUsedToSend = index;
	}

/**
 * Sorts an array of json objects by some common property, or sub-property.
 * @param {array} objArray
 * @param {array|string} prop Dot-delimited string or array of (sub)properties
 */
// function sortJsonArrayByProp(objArray, prop){
//     if (objArray && objArray.constructor===Array){
//         var propPath = (prop.constructor===Array) ? prop : prop.split(".");
//         objArray.sort(function(a,b){
//             for (var p in propPath){
//                 if (a[propPath[p]] && b[propPath[p]]){
//                     a = a[propPath[p]];
//                     b = b[propPath[p]];
//                 }
//             }
//             // convert numeric strings to integers
//             a = a.match(/^\d+$/) ? +a : a;
//             b = b.match(/^\d+$/) ? +b : b;
//             return ( (a < b) ? -1 : ((a > b) ? 1 : 0) );
//         });
//     }
// };


	

	var getTransactionHistory = function(lower, upper)
	{
		var transactionHistoryMatrix = [];
		document.getElementById("transactionDisplayList").innerHTML = '';
		app.displayStatus('Getting Transactions');
		var numAddresses = addressesMatrix.length;
// 		alert(numAddresses);
		var queryString = serverURLio;
		queryString = queryString.concat('/addrs/');
		var i;
		for (i = 0; i < addressesMatrix.length; i++)
		{
			queryString = queryString.concat(addressesMatrix[i]);
			if(i !== addressesMatrix.length - 1)
			{
				queryString = queryString.concat(',');
			}
		}
		queryString = queryString.concat('/txs?from='+lower+'&to='+upper);
		document.getElementById("historyQueryString").innerHTML = queryString;
		var j;
		var k;
		var transType;
		$.get(queryString)
			.done 
			(
				function(data)
				{
					$.each(data.items, function(index, value){
						if(value.possibleDoubleSpend !== true)
						{
							var confirmString = '';
							var epochDate = value.time*1000;
// 								alert("epoch\n"+epochDate);
							var dateTimeString = moment(epochDate).format("YYYY-MM-DD HH:mm");
// 							if(dateTimeString == 'Invalid date')
// 							{
// 								confirmString = 'UNCONFIRMED';
// 							}
							if(value.confirmations == 0)
							{
								confirmString = 'UNCONFIRMED';
							}
// 								alert("WTFFF");
							var transType = '';
							var tempValueVinMatch = 0;
							var tempValueVinTotal = 0;
							var tempValueOutMatch = 0;
							var tempValueOutChange = 0;
							var tempValueOutTotal = 0;
							var totalTransacted = 0;
							var fee = 0;
							var displayType = '';
							var displayWord = '';
							$.each(value.vin, function(index, value){
								tempValueVinTotal = tempValueVinTotal + value.valueSat;
								for(j = 0 ; j < numAddresses; j++)
								{	
// 									alert(tempValueVinTotal);
									if(addressesMatrix[j].toString() === value.addr.toString())
									{
										transType = "SENT";
// 										alert('matchvin');
										tempValueVinMatch = tempValueVinMatch + value.valueSat;
									}
								}
							});
							$.each(value.vout, function(index, value){
								var sats = stringToSatoshis(value.value.toString());
// 									alert(sats);
								tempValueOutTotal = tempValueOutTotal + sats;
								for(j = 0 ; j < numAddresses; j++)
								{	
// 									alert(tempValueOutTotal);
									if(addressesMatrix[j].toString() === value.scriptPubKey.addresses.toString() && transType !== "SENT")
									{
										transType = "RECEIVED";
// 										alert('matchvout');
										tempValueOutMatch = tempValueOutMatch + sats;
									}else if(addressesMatrix[j].toString() === value.scriptPubKey.addresses.toString() && transType === "SENT")
									{
										transType = "SENT_WITH_CHANGE";
										tempValueOutMatch = tempValueOutMatch + sats;
									}
								}
							});
							fee = tempValueVinTotal - tempValueOutTotal;
// 								alert(transType);
							if(transType === "SENT")
							{
// 									alert("tvVinM\n"+tempValueVinMatch);
// 									alert("fee\n"+fee);
								totalTransacted = tempValueOutTotal + fee;
// 									alert("totalTrans\n"+totalTransacted);
								displayType = "sent";
								displayWord = "SENT";
							}else if(transType === "RECEIVED"){
// 									alert("tvVoutM\n"+tempValueOutMatch);
								totalTransacted = tempValueOutMatch;
// 									alert("totalTrans\n"+totalTransacted);
								displayType = "received";
								displayWord = "RECEIVED";
							}else if(transType === "SENT_WITH_CHANGE"){
// 								alert("tvVinM\n"+tempValueVinMatch);
// 									alert("tvVoutM\n"+tempValueOutMatch);
// 									alert("fee\n"+fee);

								totalTransacted = tempValueVinMatch - tempValueOutMatch; 
// 									alert("totalTrans\n"+totalTransacted);
								displayType = "sent";
								displayWord = "SENT";
							};
// 								alert(totalTransacted);
							if(transType !== '')								
							{	
								transactionHistoryMatrix.push({txid: value.txid, RorS: displayType, RorSWord: displayWord, amount: totalTransacted, time: epochDate });
								var element = $(
									'<li class="'+displayType+' transactions-list">'
									+	'<strong><span class="left-sent-recv">'+displayWord+ '</span>&nbsp;<span class="right-amount">' + totalTransacted/100000000 + '</span></strong><br />'
									+	'<small><span class="left-sent-recv">'+dateTimeString+ '</span>&nbsp;<span class="right-amount">' + confirmString + '</span></small><br />'
									+	'<span class="selectable"><small>'+value.txid.slice(0,32)+'</small><br />'
									+	'<small>'+value.txid.slice(32,64)+'</small></span><br />'
// 									+	'<hr><br />'
									+ '</li>'
									);
								$('#transactionDisplayList').append(element);
							}
						}
					});
				}
			);
		app.displayStatus('Ready');
		$('#transactionHistoryButton').attr('disabled',false);
	};

	
	var stringToSatoshis = function(amountAsString)
	{
// 		alert(amountAsString);
		amountAsString = amountAsString.replace(/\./g,'');
// 		alert(amountAsString);
		var amountAsInteger = 0;
		var i;
		var amountArray = amountAsString.split("");
		amountArray.reverse();
// 		alert(amountArray.length);
		for(i = 0; i < amountArray.length; i++)
		{
			amountAsInteger = amountAsInteger + ((parseInt(amountArray[i]))*(Math.pow(10,i)));
// 			alert(amountAsInteger);
		}
		return amountAsInteger;
	}
	

	var rawSubmitAuto = function(txData)
	{ 
		app.displayStatus('Submitting..');
// 		alert(txData);
// 		$("#rawTransactionStatus2").addClass('hidden');
// 		var thisbtn = "#signAndSendStandard";		
// 		$(thisbtn).val('Please wait, loading...').attr('disabled',true);
		$.ajax ({
			type: "POST",
			url: serverURL + '/tx/send',
			data: {'rawtx': txData},
			dataType: "json",
			error: function(data) {
				$("#rawTransactionStatus2").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(" There was an error submitting your request, please try signing/submitting again\n " + JSON.stringify(data)).prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
			},
            success: function(data) {
            	var returnInfo = JSON.stringify(data);
            	console.log("returned: " + returnInfo);
					$("#rawTransactionStatus2").addClass('alert-success').removeClass('alert-danger').removeClass('hidden');
            		$("#rawTransactionStatus2").html('txid: '+returnInfo.slice(9,38)+'<br>'+ returnInfo.slice(39,66) +'<br>'+returnInfo.slice(67,73));
            		navigator.notification.beep(1);
            		window.plugins.toast.show('SUCCESS', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
			},
			complete: function(data, status) {
				$("#rawTransactionStatus2").fadeOut().fadeIn();
				app.displayStatus('Ready');
			}
		});
		document.getElementById('payment_title').innerHTML =  '';
		app.displayStatus('Refreshing balances...');
		onUpdateSourceKey();
			
		currentCommand = '';
	}


	var fixAndroidHeight = function()
	{
		if(platform == "android")
		{	
		    $(".navbar").addClass('no-top-padding');

		}
	}









/**
 * Application object that holds data and functions used by the app.
 */
var app =
{
// 	scanner part
	devices: {},
// 	ui: {},
	updateTimer: null,
	
	// Discovered devices.
	knownDevices: {},
	selectedDevice: {},

	// Reference to the device we are connecting to. Unused
// 	connectee: null,

	// Handle to the connected device.
	deviceHandle: null,

	// Handles to characteristics and descriptor for reading and
	// writing data from/to the Arduino using the BLE shield.
	characteristicRead: null,
	characteristicWrite: null,
	descriptorNotification: null,
	pinTheFirst: 0,
	pinFirstDecline: 0,
	characteristicName: null,
	
	displayStatus: function(status)
	{
		if(document.getElementById('status').innerHTML == status)
			return;
		console.log('Status: '+status);
		document.getElementById('status').innerHTML = status
	},



	initialize: function()
	{
		document.addEventListener(
			'deviceready',
			function() { 
				fixAndroidHeight();
        		globalPINstatus = app.getPINstatus();
        		$(".expert").addClass('hidden');
        		$(".standard").removeClass('hidden');
				displayMode = 'STANDARD';
				evothings.scriptsLoaded(app.onDeviceReady); 
				StatusBar.styleLightContent();
				app.getPIN(globalPINstatus);
			},
			false);
	},


	hiddenWalletCallback: function (results)
	{
		if(results.buttonIndex == 1)
		{
// 			event.preventDefault();
			currentCommand = "loadWallet";
			directLoadWallet(results.input1);
			app.displayStatus('Loading wallet');

			window.plugins.toast.show('Check your BitLox', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
			document.getElementById("loaded_wallet_name").innerHTML = "<small><i>HIDDEN</i></small>";

		}
		if(results.buttonIndex == 2)
		{
			// Cancel clicked
		}
	},





	PINcallback: function (results)
	{
		if(results.buttonIndex == 1)
		{
			var PINvalue = window.localStorage['PINvalue'];
			// OK clicked, show input value
			if(results.input1 != PINvalue)
			{
				app.initialize();
			}else if(results.input1 === PINvalue){
				$("#theBody").removeClass('grell');
				$('#myTab a[href="#ble_scan"]').tab('show');
				$("#renameWallet").attr('disabled',true);
			}

		}
		if(results.buttonIndex == 2)
		{
			// Cancel clicked
			app.initialize();
		}
	},


	firstPINcache: function (resultsFirst)
	{
		if(resultsFirst.buttonIndex == 1)
		{
			app.pinTheFirst = resultsFirst.input1;
// 			alert(app.pinTheFirst);
			pausecomp(300);
			window.plugins.pinDialog.prompt("Verify your desired PIN", app.PINsetcallback, "RE-ENTER APP PIN", ["OK","Cancel"]);

		}else if(resultsFirst.buttonIndex == 2)
		{
// 		alert("You can later set a PIN in the extras menu");
			app.pinFirstDecline = 1;
			// Cancel clicked
        	window.plugins.toast.show('Canceled', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
			$("#theBody").removeClass('grell');
			$('#myTab a[href="#ble_scan"]').tab('show');
			$("#renameWallet").attr('disabled',true);
		}
	},

	PINsetcallback: function (results)
	{
		if(results.buttonIndex == 1)
		{
			if(results.input1 == app.pinTheFirst)
			{
				window.localStorage['PINvalue'] = results.input1;
				var PINvalue = window.localStorage['PINvalue'];
				window.plugins.toast.show('PIN set to: ' + PINvalue, 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
// 				alert('PIN set to: ' + PINvalue);
				window.localStorage['PINstatus'] = 'true';
				var PINstatus = window.localStorage['PINstatus'];
				globalPINstatus = 'true';
				$("#theBody").removeClass('grell');
				$('#myTab a[href="#ble_scan"]').tab('show');
				$("#renameWallet").attr('disabled',true);
			}else
			{
				window.plugins.toast.show('PINs don\'t match', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
				pausecomp(300);
				app.setAppPIN();
			}
		}
		if(results.buttonIndex == 2)
		{
			// Cancel clicked
        	window.plugins.toast.show('Canceled', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
			$("#theBody").removeClass('grell');
			$('#myTab a[href="#ble_scan"]').tab('show');
			$("#renameWallet").attr('disabled',true);
		}
	},

	showAppPIN: function()
	{
		alert('globalPINstatus' + globalPINstatus);
		var PINstatus = window.localStorage['PINstatus'];
		alert('PINstatus' + PINstatus);
	},


	setAppPIN: function()
	{
		window.plugins.pinDialog.prompt("Enter your desired PIN", app.firstPINcache, "SET APP PIN", ["OK","Cancel"]);
	},

	getPINstatus: function()
	{
		var PINstatus = window.localStorage['PINstatus'];
		return PINstatus;	
	},


	getPIN: function (status)
	{
			
			if(status === 'true'){
				window.plugins.pinDialog.prompt("Enter App PIN to proceed", app.PINcallback, "SECURE AREA", ["OK","Cancel"]);
			}else if(status !== 'false' && status !== 'true'){
				pausecomp(1000);
				app.setAppPIN();
			}
	},


	// Called when device plugin functions are ready for use.
	onDeviceReady: function()
	{
		
		ble = evothings.ble; // Evothings BLE plugin
// 		app.startScanNew();
	},




// 	startScan: function()
// 	{
// // 		app.stopScan();
// 		app.displayStatus('Starting scan...');
// 		app.displayStatus('Scanning...');
// 		evothings.ble.startScan(
// 			function(deviceInfo)
// 			{
// 				if (app.knownDevices[deviceInfo.address])
// 				{
// 					return;
// 				}
// 				console.log('found device: ' + deviceInfo.name);
// 				app.knownDevices[deviceInfo.address] = deviceInfo;
// /**
// *				This is used if a specifically named device is desired
// */				
// // 				if (deviceInfo.name == 'bitlox-1' && !app.connectee)
// // 				{
// // 					console.log('Found bitlox');
// // 					connectee = deviceInfo;
// // 					pausecomp(5000);
// // 					app.connect(deviceInfo.address);
// // 				}
// 				if(platform == "android")
// 				{
// 					pausecomp(500);
// 				}
// 
// 				app.connect(deviceInfo.address);
// 
// 			},
// 			function(errorCode)
// 			{
// 				app.displayStatus('startScan error: ' + errorCode);
// 			});
// 	},

	// Start the scan. Call the callback function when a device is found.
	// Format:
	//   callbackFun(deviceInfo, errorCode)
	//   deviceInfo: address, rssi, name
	//   errorCode: String
	startScanNew: function(callbackFun)
	{
		app.stopScan();
		app.displayStatus('Scanning...');
		evothings.ble.startScan(
			function(device)
			{
				// Report success. Sometimes an RSSI of +127 is reported.
				// We filter out these values here.
				if (device.rssi <= 0)
				{
					callbackFun(device, null);
				}
			},
			function(errorCode)
			{
				// Report error.
				callbackFun(null, errorCode);
			}
		);
	},

// 	reconnect: function()
// 	{
// 		app.displayStatus('Reconnecting...');
// 		evothings.ble.startScan(
// 			function(device)
// 			{
// 				console.log('found device: ' + device.name);
// 				app.knownDevices[device.address] = device;
// /**
// *				This is used if a specifically named device is desired
// */				
// // 				if (deviceInfo.name == 'bitlox-1' && !app.connectee)
// // 				{
// // 					console.log('Found bitlox');
// // 					connectee = deviceInfo;
// // 					pausecomp(5000);
// // 					app.connect(deviceInfo.address);
// // 				}
// 				if(platform == "android")
// 				{
// 					pausecomp(500);
// 				}
// 
// 				app.connect(device.address);
// 			},
// 			function(errorCode)
// 			{
// 				app.displayStatus('reconnect: ' + errorCode);
// 			});
// 	},

	connect: function(address)
	{
		evothings.ble.stopScan();
		app.displayStatus('Connecting...');
		evothings.ble.connect(
			address,
			function(connectInfo)
			{
				if (connectInfo.state == 2) // Connected
				{
					if(platform == "android")
					{
						pausecomp(500);
					}
					app.deviceHandle = connectInfo.deviceHandle;
					app.getServices(connectInfo.deviceHandle);
// 					connectedDevices[address] = address;
				}
				else
				{
					app.displayStatus('Disconnected');
					pausecomp(50);
					app.connect(address);
				}
			},
			function(errorCode)
			{
				app.displayStatus('connect: ' + errorCode);
			});
			$('#list_wallets').attr('disabled',false);
	},

	/** Close all connected devices. */
	closeConnectedDevices: function()
	{
			$.each(app.knownDevices, function(key, device)
			{
				app.deviceHandle && evothings.ble.close(app.deviceHandle);
			});
		app.knownDevices = {};
	
	},



/**
* 	Chops up the command/data to send into either 64 byte (iOS) or 20 byte (android) chunks, 
* 	zero-fills out to the end of the current frame and transforms into a byte buffer for sending out via BLE
*   This command replaces the previously used "hidWriteRawData" and is aliased inside of "autoCannedTransaction" as it
*	replaces the functions of both of those.
*	As iOS and Android seem to have different tolerances for transmission speed, the blocksize and transmission delay 
*	are broken out for each. It may be desirable in the settings of the app that these parameters could be "Tuned" to different handsets.
*	(My testbed is an old Huawei Android handset) - or possible dynamically set via a ping/echo check of connectivity speed.
*	data: hex encoded string
*/	
	sliceAndWrite64: function(data)
	{
		var chunkSize;
		if(platform == "android")
		{
			chunkSize = 40;  // android
			console.log('ChunkSize set to: ' + chunkSize);
		}
		else
		{
			chunkSize = 128;
			console.log('ChunkSize set to: ' + chunkSize);
		}
		
		var thelength = data.length;
		var iterations = Math.floor(thelength/chunkSize);
		console.log('iterations : ' + iterations);
		var remainder  = thelength%chunkSize;
		console.log('remainder : ' + remainder);
		var k = 0;
		var m = 0;
		var transData = [];
		
// 		chop the command up into k pieces
		for(k = 0; k < iterations; k++)
		{
			transData[k] = data.slice(k*chunkSize,chunkSize+(k*chunkSize));
			console.log("k " + k);
		};
		
		console.log("k out " + k);

// 		deal with the leftover, backfilling the frame with zeros		
		if(remainder != 0)
		{
			transData[k] = data.slice((k)*chunkSize,remainder+((k)*chunkSize));
			for (m = remainder; m < chunkSize; m++)
			{
				transData[k] = transData[k].concat("0");
			}
			console.log("remainder " + transData[k]);
		
			console.log("remainder length " + transData[k].length);
		};

// 		The BLE writer takes ByteBuffer arrays		
		var ByteBuffer = dcodeIO.ByteBuffer;
		var j = 0;
		var parseLength = 0;
		console.log("transData.length " + transData.length);
		for (j = 0; j< transData.length; j++)
		{   
			parseLength = transData[j].length

			var bb = new ByteBuffer();
		// 	console.log("utx length = " + parseLength);
			var i;
			for (i = 0; i < parseLength; i += 2) {
				var value = transData[j].substring(i, i + 2);
		// 	console.log("value = " + value);		
				var prefix = "0x";
				var together = prefix.concat(value);
		// 	console.log("together = " + together);
				var result = parseInt(together);
		// 	console.log("result = " + result);

				bb.writeUint8(result);
			}
			bb.flip();

			app.passToWrite(bb);
			if(platform == "android")
			{
				pausecomp(100);
			}
		}
	},


// 	This function adds the parameters the write function needs
	passToWrite: function(passedData)
	{
		app.write(
			'writeCharacteristic',
			app.deviceHandle,
			app.characteristicWrite,
			passedData
			); 
	},


// 	This function adds the parameters the write function needs
	writeDeviceName: function(newDeviceName)
	{
// 		alert("name: "+app.characteristicName);
// 		alert("write: "+app.characteristicWrite);

// 		app.write(
// 			'writeDescriptor',
// 			app.deviceHandle,
// 			app.descriptorName,
// 			new Uint8Array([35,35,61,61]));
	
		app.writeWithResults(
			'writeCharacteristic',
			app.deviceHandle,
			app.characteristicName,
			newDeviceName);
	},
	
	

// 	Actual write function
	write: function(writeFunc, deviceHandle, handle, value)
	{
		if (handle)
		{
			ble[writeFunc](
				deviceHandle,
				handle,
				value,
				function()
				{
// 					alert(writeFunc + ': ' + handle + ' success.');
					console.log(writeFunc + ': ' + handle + ' success.');
				},
				function(errorCode)
				{
// 					alert(writeFunc + ': ' + handle + ' error: ' + errorCode);

					console.log(writeFunc + ': ' + handle + ' error: ' + errorCode);
				});
		}
		
	},

// 	Actual write function
	writeWithResults: function(writeFunc, deviceHandle, handle, value)
	{
		if (handle)
		{
			ble[writeFunc](
				deviceHandle,
				handle,
				value,
				function()
				{
					window.plugins.toast.show('Device renamed successfully', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
// 					alert(writeFunc + ': ' + handle + ' success.');
					console.log(writeFunc + ': ' + handle + ' success.');
				},
				function(errorCode)
				{
// 					alert(writeFunc + ': ' + handle + ' error: ' + errorCode);

					console.log(writeFunc + ': ' + handle + ' error: ' + errorCode);
				});
		}
		$('#myTab a[href="#ble_scan"]').tab('show');
		$('#renameDeviceButton').attr('disabled',false);
		app.onStopScanButton();
		app.onStartScanButton();
	},

/**
* 	Reads the datastream after subscribing to notifications.
* 	Bytes are read off one at a time and assembled into a frame which is then passed to 
* 	be processed. The passed frame may not contain the whole message, which will be completed
* 	in subsequent frames. Android needs a shim of ~10 ms to properly keep up.
*/
	startReading: function(deviceHandle)
	{
		app.displayStatus('Enabling notifications...');
		
		var sD = '';
		console.log('data at beginning: ' + sD);		
		
		// Turn notifications on.
		app.write(
			'writeDescriptor',
			deviceHandle,
			app.descriptorNotification,
			new Uint8Array([1,0]));

		// Start reading notifications.
		evothings.ble.enableNotification(
			deviceHandle,
			app.characteristicRead,
			function(data)
			{
				app.displayStatus('Active');
				var buf = new Uint8Array(data);
				for (var i = 0 ; i < buf.length; i++)
				{
					sD = sD.concat(d2h(buf[i]).toString('hex'));
				};

				console.log('data semifinal: ' + sD);
				for (var i = 0 ; i < buf.length; i++)
				{
					buf[i] = 0;
				};
				app.sendToProcess(sD);
				sD = '';
				if(platform == "android")
				{
					pausecomp(10);
				}

			},
			function(errorCode)
			{
				app.displayStatus('enableNotification error: ' + errorCode);
			});
		app.displayStatus('Ready');
	},

/**
* 	Assembles whole message strings
* 	The raw data is going to be coming in in possible uncompleted parts.
* 	We will sniff for the 2323 and commence storing data from there. 
* 	The payload size is grabbed from the first 2323 packet to determine when we are done and
* 	may send the received message onwards.
*/
	sendToProcess: function(rawData)
	{
		console.log('data final: ' + rawData);
		var rawSize = rawData.length;
		console.log('rawSize: ' + rawSize);
		console.log('incomingData at top ' + incomingData);

		// Grab the incoming frame and add it to the global incomingData
        // We match on 2323 and then toggle the dataReady boolean to get ready for any subsequent frames
		if (rawData.match(/2323/) || dataReady == true)
		{
			console.log('or match ');
			incomingData = incomingData.concat(rawData);
			console.log('incomingData ' + incomingData);

// 			Find out how long the total message is. This must be stored globally as the 
// 			sendToProcess routine is called repeatedly blanking local variables
			if (incomingData.match(/2323/)) 
			{
				console.log('header match');
				dataReady = true;
				var headerPosition = incomingData.search(2323)
				payloadSize = incomingData.substring(headerPosition + 8, headerPosition + 16)
				console.log('PayloadSize hex: ' + payloadSize);
				var decPayloadSize = parseInt(payloadSize, 16);
				console.log('decPayloadSize: ' + decPayloadSize);
				console.log('decPayloadSize*2 + 16: ' + ((decPayloadSize *2) + 16));
			}
		}
// 		Once the incomingData has grown to the length declared, send it onwards.
		if(incomingData.length === ((decPayloadSize*2) + 16))
		{
			var dataToSendOut = incomingData;
			incomingData = '';
			dataReady = false;
			app.finalPrepProcess(dataToSendOut);
		}
	},

/**
 *	Takes whole message strings and preps them for consumption by the processResults function
*/
	finalPrepProcess: function(dataToProcess)
	{
			if (dataToProcess.match(/2323/)) {
				var headerPosition = dataToProcess.search(2323);
				var command = dataToProcess.substring(headerPosition + 4, headerPosition + 8);
				document.getElementById("command").innerHTML = command;
				var payloadSize2 = dataToProcess.substring(headerPosition + 8, headerPosition + 16);
				console.log('PayloadSize: ' + payloadSize2);
				var decPayloadSize = parseInt(payloadSize2, 16);
				console.log('decPayloadSize: ' + decPayloadSize);
				console.log('decPayloadSize*2 + 16: ' + ((decPayloadSize *2) + 16));

				document.getElementById("payLoadSize").innerHTML = payloadSize2;
				var payload = dataToProcess.substring(headerPosition + 16, headerPosition + 16 + (2 * (decPayloadSize)));
				document.getElementById("payload_HEX").innerHTML = payload;
				document.getElementById("payload_ASCII").innerHTML = hex2a(payload);
				console.log('ready to process: ' + dataToProcess);
				processResults(command, payloadSize2, payload);
			}
	},

/**
 * 	Opens reading & writing services on the BitLox device. The uuids are specific to the BitLox hardware
*/
	getServices: function(deviceHandle)
	{
		app.displayStatus('Reading services...');
// 		alert('deviceHandle: ' + deviceHandle);
		evothings.ble.readAllServiceData(deviceHandle, function(services)
		{
			// Find handles for characteristics and descriptor needed.
			for (var si in services)
			{
				var service = services[si];
// 				alert(service);
				for (var ci in service.characteristics)
				{
					var characteristic = service.characteristics[ci];

					if (characteristic.uuid == '0000ffe4-0000-1000-8000-00805f9b34fb')
					{
						app.characteristicRead = characteristic.handle;
					}
					else if (characteristic.uuid == '0000ffe9-0000-1000-8000-00805f9b34fb')
					{
						app.characteristicWrite = characteristic.handle;
					}
					else if (characteristic.uuid == '0000ff91-0000-1000-8000-00805f9b34fb')
					{
						app.characteristicName = characteristic.handle;
					}

					for (var di in characteristic.descriptors)
					{
						var descriptor = characteristic.descriptors[di];

						if (characteristic.uuid == '0000ffe4-0000-1000-8000-00805f9b34fb' &&
							descriptor.uuid == '00002902-0000-1000-8000-00805f9b34fb')
						{
							app.descriptorNotification = descriptor.handle;
						}
						if (characteristic.uuid == '0000ff91-0000-1000-8000-00805f9b34fb' &&
							descriptor.uuid == '00002901-0000-1000-8000-00805f9b34fb')
						{
							app.descriptorName = descriptor.handle;
						}
					}
				}
			}
			
			if (app.characteristicRead && app.characteristicWrite && app.descriptorNotification && app.characteristicName && app.descriptorName)
			{
				console.log('RX/TX services found.');
				app.startReading(deviceHandle);
			}
			else
			{
				app.displayStatus('ERROR: RX/TX services not found!');
			}
		},
		function(errorCode)
		{
			app.displayStatus('readAllServiceData error: ' + errorCode);
		});
	},

	openBrowser: function(url)
	{
		window.open(url, '_system', 'location=yes')
	},
	
	scanQR:	function()
	{
		cloudSky.zBar.scan(
		{
// 			camera: "back" // defaults to "back" 
// 			flash: "auto", // defaults to "auto". See Quirks 
			drawSight: false //defaults to true, create a red sight/line in the center of the scanner view. 
		}, function(s){
			s = s.replace(/bitcoin\:/g,'');
			document.getElementById('receiver_address').value = s;
			app.displayStatus('QR code scanned');
		}, function(){
			app.displayStatus('Error scanning QR');
		});
	},
	




// Stop scanning for devices.
stopScan: function()
{
	evothings.ble.stopScan();
},

// Called when Start Scan button is selected.
onStartScanButton: function()
{
	app.closeConnectedDevices();
	app.stopScan();
	app.knownDevices = {};
	app.startScanNew(app.deviceFound);
	app.displayStatus('Scanning...');
	app.updateTimer = setInterval(app.displayDeviceList, 1000);
	app.displayDeviceList;
},

// Called when Stop Scan button is selected.
onStopScanButton: function()
{
	app.closeConnectedDevices();
	app.stopScan();
	
	app.knownDevices = {};
	app.displayStatus('Scan stopped');
	app.displayDeviceList();
	clearInterval(app.updateTimer);
},

// Called when a device is found.
deviceFound: function(device, errorCode)
{
	if (device)
	{
		// Set timestamp for device (this is used to remove
		// inactive devices).
		device.timeStamp = Date.now();
		// Insert the device into table of found devices.
		app.knownDevices[device.address] = device;
	}
	else if (errorCode)
	{
		app.displayStatusScanner('Scan Error: ' + errorCode);
	}
},

// Display the device list.
displayDeviceList: function()
{
	// Clear device list.
	$('#found-devices').empty();
	var timeNow = Date.now();

	$.each(app.knownDevices, function(key, device)
	{
		// Only show devices that are updated during the last 10 seconds.
		if (device.timeStamp + 10000 > timeNow)
		{
			// Map the RSSI value to a width in percent for the indicator.
			var rssiWidth = 100; // Used when RSSI is zero or greater.
			if (device.rssi < -100) { rssiWidth = 0; }
			else if (device.rssi < 0) { rssiWidth = 100 + device.rssi; }

			// Create tag for device data.
			var element = $(
				'<li id="device_chosen" class="deviceSelection device-list" data-target="#bip32"  data-addr="'+ device.address +'" data-name="'+device.name+'">'
				+	'<span >'
				+	'<strong>' + device.name + '</strong><br />'
				// Do not show address on iOS since it can be confused
				// with an iBeacon UUID.
// 				+	(evothings.os.isIOS() ? '' : device.address + '<br />')
// 				+	(evothings.os.isIOS() ? device.address : device.address + '<br />')
				+	'<small><span class="left-label">SIGNAL STRENGTH  </small></span>&nbsp;<span class="right-signal">' +device.rssi + ' dB</span><br />'
				+ 	'<div style="background:rgb(225,0,0);height:20px;width:'
				+ 		rssiWidth*2 + '%;"></div>'
				+	'</span>'
				+ '</li>'
			);

			$('#found-devices').append(element);
		}
	});
},



// Display a status message
displayStatusScanner: function(message)
{
	$('#scan-status').html(message);
}


};
// End of app object.



// 	var goWalletsList = function()
// 	{
// 		$('#myTab a[href="#bip32"]').tab('show');
// 	}


/**
 * Called when HTML page has been loaded.
 */
$(document).ready( function()
{
		app.initialize();

        $('#vrVerify').click(vrVerify);
        onInput('#vrSig', vrOnChangeSig);

        $('#sgType label input').on('change', sgOnChangeType);

        $('#vrSig').val('-----BEGIN BITCOIN SIGNED MESSAGE-----\n'
        +'This is an example of a signed message\n'
        +'-----BEGIN SIGNATURE-----\n'
        +'14MneZfcbQsaM37ajLVij9C5hEejoYgjyM\n'
        +'H7LWGhA7DlEv8l1/YH1dEPLsPX//p+ZDsEz/D2Ye3lLYWFhOyatTVTtFT/WdpIWfQwDp4qp8aKT9fez6HgwmXGg=\n'
        +'-----END BITCOIN SIGNED MESSAGE-----');

		$(document).on("click", ".deviceSelection", function() {
			var myAddress = $(this).data('addr');
			app.connect(myAddress);
			document.getElementById("device_name").innerHTML = $(this).data('name');
			document.getElementById("device_addr").innerHTML = myAddress;
			
			$('#myTab a[href="#bip32"]').tab('show');

			console.log("device-->" + myAddress);
		});
		
		$('#transactionHistoryButton').on('click', function() {
			if($('#transactionHistoryButton').attr('disabled')){
			}else{
				$('#transactionHistoryButton').attr('disabled',true);
				$('#transactionDisplayListHeading').attr('hidden',false);
				getTransactionHistory(0,25);
			}
		});

		$('#hiddenWallet').on('click', function() {
			window.plugins.pinDialog.prompt("Enter Wallet Number", app.hiddenWalletCallback, "Hidden Wallet", ["OK","Cancel"]);
		});


        $('#renameDeviceButton').on('click', function() {
        	if($('#renameDeviceButton').attr('disabled')){
        	}else{
        		$('#renameDeviceButton').attr('disabled',true);
				navigator.notification.prompt(
					'Max 15 characters',  // message
					onPromptRenameDevice,                  // callback to invoke
					'Rename Device',            // title
					['Rename','Cancel'],             // buttonLabels
					''                 // defaultText
				); 
			} 
        });

        $('#modeButton').on('click', function() {
            event.preventDefault();
        		$(".standard").toggleClass('hidden');
        		$(".expert").toggleClass('hidden');
        	if(displayMode == 'STANDARD')
        	{
				displayMode = 'EXPERT';
				window.plugins.toast.show('EXPERT mode enabled', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
			}else if(displayMode == 'EXPERT')
			{
				displayMode = 'STANDARD';
				window.plugins.toast.show('STANDARD mode enabled', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
			}

		});
		

        onInput("#bip32_source_key", onUpdateSourceKey);
        
        $('#brand').on('click', function() {
        	var address = document.getElementById("device_addr").text;
        	app.connect(address);
		});



		$('#deleteWalletButton').on('click', function() {
			event.preventDefault();
			if(walletsListForPicker == '')
			{
// 				navigator.notification.alert("List wallets first", goWalletsList, NOTICE, OK);

				alert("List wallets first");
			}else{
				deleteWalletPicker(makePickerListWallets());
			}
		});

        $('#forceRefresh').on('click', function() {
        	if($('#forceRefresh').attr('disabled')){
        	}else{
				event.preventDefault();
				$('#forceRefresh').attr('disabled',true);
				app.displayStatus('Refreshing balances...');
				onUpdateSourceKey();
			}
		});

        $('#testPIN').on('click', function() {
        	app.showAppPIN();
		});


        $('#setPINbutton').on('click', function() {
        	app.setAppPIN();
		});

        $('#submit_signed_transaction').on('click', function() {
        	submitTransaction();
		});

        $('#scanQRcode').on('click', function() {
        	app.scanQR();
		});

//         $('#restoreWallet').on('click', function() {
//             event.preventDefault();
//             constructNewWalletRestore();
// 		});

        $('#signAndSendStandard').on('click', function() {
        	if($('#signAndSendStandard').attr('disabled')){
        	}else{
				if(document.getElementById('receiver_address').value == ''){
				}else{
					$('#signAndSendStandard').attr('disabled',true);
					currentCommand = 'signAndSend';
					document.getElementById('output_transaction').value = '';
					if(document.getElementById('receiver_monies').value == 0){
							navigator.notification.confirm(
							'Amount is 0, are you sure?',  // message
							zeroSendResponse,         // callback
							'Amount Notice',            // title
							['SEND','CANCEL']                  // buttonName
						);
					}else{
						genTransaction();
						window.plugins.toast.show('Check your BitLox', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
					}
				}
			}
		});

		function zeroSendResponse(buttonIndex)
		{
			if(buttonIndex === 1)
			{
				window.plugins.toast.show('Check your BitLox', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
				currentCommand = 'signAndSend';
				genTransaction();
			}else{
				$('#signAndSendStandard').attr('disabled',false);
				currentCommand = '';
			}
		};
		
		
        $('#generate_transaction').on('click', function() {
        	document.getElementById('output_transaction').value = '';
//         	document.getElementById('device_signed_transaction').value = '';
//         	document.getElementById('ready_to_transmit').value = '';
        	genTransaction();
        	
        	
		});

        $('#prep_for_device').click(prepForSigning);
//         $('#sign_transaction_with_device').click(sendTransactionForSigning);
        

        
        
        
        $('#sign_transaction_with_device').on('click', function() {
        	event.preventDefault();
        	document.getElementById("rawTransaction").value = '';
        	window.plugins.toast.show('Check your BitLox', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
        	sendTransactionForSigning();
        });
        
        
        $('#sgSignDevice').on('click', function() {
        	event.preventDefault();
        	window.plugins.toast.show('Check your BitLox', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
			app.displayStatus('Signing message');
        	signMessageWithDevice();
        });


        $('#PutAll').on('click', function() {
            event.preventDefault();
            putAll();
        });

        $('#statusToggle').on('click', function() {
            event.preventDefault();
            app.reconnect();
        });


        $('#initialize').on('click', function() {
            event.preventDefault();
            initialize_protobuf_encode();
        });

        $('#raw_input_button').on('click', function() {
            event.preventDefault();
            var toSendRaw = document.getElementById('raw_input').value;
            
            console.log("RAW: " + toSendRaw);
            autoCannedTransaction(toSendRaw);
        });

        $('#direct_load_wallet').on('click', function() {
            event.preventDefault();
            var walletToLoad = document.getElementById('direct_load_wallet_input').value;
            directLoadWallet(walletToLoad);
        });

        $('#entropy').on('click', function() {
            event.preventDefault();
            var entropy_value = document.getElementById('entropy_input').value;
            getEntropy(entropy_value);
        });

        $('#ping').on('click', function() {
            constructPing();
        });

//         $('#format_storage').on('click', function() {
//             app.sliceAndWrite64(deviceCommands.format_storage);
//         });

		function formatResponse(buttonIndex)
		{
			if(buttonIndex === 1)
			{
				window.plugins.toast.show('Check your BitLox', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
				currentCommand = 'formatDevice';
				app.displayStatus('Formatting');
				app.sliceAndWrite64(deviceCommands.format_storage);
			}
		};

        $('#formatDevice').on('click', function() {
			navigator.notification.confirm(
				'ERASE ALL WALLETS AND THE BITCOINS IN THEM',  // message
				formatResponse,         // callback
				'FORMAT BITLOX',            // title
				['FORMAT','CANCEL']                  // buttonName
			);
        });

        $('#button_ack').on('click', function() {
            app.sliceAndWrite64(deviceCommands.button_ack);
        });

        $('#button_cancel').on('click', function() {
            app.sliceAndWrite64(deviceCommands.button_cancel);
        });


//         $('#new_wallet').on('click', function() {
//             app.sliceAndWrite64(deviceCommands.new_wallet);
//         });

//         $('#new_wallet_default').on('click', function() {
//             app.sliceAndWrite64(deviceCommands.new_wallet_default);
//         });

        $('#get_entropy_32_bytes').on('click', function() {
            app.sliceAndWrite64(deviceCommands.get_entropy_32_bytes);
        });


        $('#otp_ack').on('click', function() {
            app.sliceAndWrite64(constructOTP());
        });

        $('#otp_cancel').on('click', function() {
            app.sliceAndWrite64(deviceCommands.otp_cancel);
        });

        $('#pin_ack').on('click', function() {
            constructPIN();
        });

        $('#pin_cancel').on('click', function() {
            app.sliceAndWrite64(deviceCommands.pin_cancel);
        });


//         $('#get_device_uuid').on('click', function() {
//             app.sliceAndWrite64(deviceCommands.get_device_uuid);
//         });


//         $('#reset_lang').on('click', function() {
//             app.sliceAndWrite64(deviceCommands.reset_lang);
//         });

        $('#resetLanguage').on('click', function() {
            app.sliceAndWrite64(deviceCommands.reset_lang);
            window.plugins.toast.show('Check your BitLox', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
        });


//         $('#scan_wallet').on('click', function() {
//             event.preventDefault();
//             app.sliceAndWrite64(deviceCommands.scan_wallet);
//         });

        $('#newWalletButton').on('click', function() {
        	if($('#newWalletButton').attr('disabled')){
        	}else{
				$('#newWalletButton').attr('disabled',true);
				currentCommand = 'newWallet';
				navigator.notification.prompt(
					'Max 40 characters',  // message
					onPromptNewWallet,                  // callback to invoke
					'New Wallet Name',            // title
					['Create','Cancel'],             // buttonLabels
					''                 // defaultText
				);  
			}
        });

        $('#renameWallet').on('click', function() {
        	if($('#renameWallet').attr('disabled')){
        	}else{
        		$('#renameWallet').attr('disabled',true);
				currentCommand = 'renameWallet';
				navigator.notification.prompt(
					'Max 40 characters',  // message
					onPromptRename,                  // callback to invoke
					'Rename Wallet',            // title
					['Rename','Cancel'],             // buttonLabels
					''                 // defaultText
				);  
			}
        });

        $('#rename_wallet_variable').on('click', function() {
            app.sliceAndWrite64(constructRenameWallet());
        });

//         $('#new_wallet_action').on('click', function(event) {
//             event.preventDefault();
//             constructNewWallet();
//         });

        $('#device_restore_wallet_action').on('click', function(event) {
            event.preventDefault();
            constructDeviceRestoreWallet();
            window.plugins.toast.show('Check your BitLox', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
        });

//         $('#uuid').on('click', function() {
//             event.preventDefault();
//             app.sliceAndWrite64(deviceCommands.get_device_uuid);
//         });

        $('#sendButton').on('click', function() {
            event.preventDefault();
			document.getElementById("payment_title").value = '';
			document.getElementById("receiver_address").value = ''; 
			document.getElementById("receiver_monies").value = '';
			document.getElementById("output_transaction").value = '';
			document.getElementById("rawTransaction").value = '';
			document.getElementById("device_signed_transaction").value = '';
			$("#rawTransactionStatus").addClass('hidden');

            var theBalance = document.getElementById('balance_display').innerHTML;
            document.getElementById('payment_title').innerHTML = theBalance;
            $('#myTab a[href="#sendPayment"]').tab('show');
            app.displayStatus('Ready');
        });

		$('#receiveButton').on('click', function() {
// 			requestQRdisplay(indexToNextDisplay);
		   $(this).attr('data-addr', addressesMatrixReceive[indexToNextDisplay]);
		   
		});




//         $('#payments_toggle').click(function() {
//             $('#payments_panel').slideToggle('fast', function() {
//                 // Animation complete.
//             });
//         });

        $('#txAddDest').click(txOnAddDest);
        $('#txRemoveDest').click(txOnRemoveDest);

        $('#list_wallets').on('click', function(event) {
            if($('#list_wallets').attr('disabled')){
            }else{
				$('#newWalletButton').attr('disabled',true);
				$('#list_wallets').attr('disabled',true);
				$('.wallet_row').attr('disabled',true);
				event.preventDefault();
				currentCommand = 'listWallets';
				window.plugins.toast.show('Fetching your wallet list', 'short', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
				document.getElementById("wallet_list_text").text = 'Wallets';

				$('#helpBlock').text('Click the wallet name and enter the PIN on your BitLox');
			
				app.sliceAndWrite64(deviceCommands.list_wallets);

				app.displayStatus('Listing wallets');
            }
        });



        $(document).on("click", ".wallet_row", function() {
            if($('.wallet_row').attr('disabled')){
            }else{
				$('.wallet_row').attr('disabled',true);
				$('#list_wallets').attr('disabled',true);
				$("#newWalletButton").attr('disabled',true);
				event.preventDefault();
				currentCommand = "loadWallet";
				directLoadWallet($(this).data('number'));
				app.displayStatus('Loading wallet');

				document.getElementById("loaded_wallet_name").innerHTML = document.getElementById("name_"+$(this).data('number')).innerHTML;
				window.plugins.toast.show('Check your BitLox', 'long', 'center', function(a){console.log('toast success: ' + a)}, function(b){alert('toast error: ' + b)});
			}
        });


        $(document).on("click", "#GetAll", function() {
            event.preventDefault();
            app.sliceAndWrite64(deviceCommands.GetAllWallets);
        });

	$('.nav-collapse').click('li', function() {
	  $('.nav-collapse').collapse('hide');
	});


	/* broadcast a transaction */

	$("#rawSubmitBtn").click(function(){
		rawSubmitDefault(this);
	});


	function rawSubmitDefault(btn){ 
		$("#rawTransactionStatus").addClass('hidden');
		var thisbtn = btn;		
		$(thisbtn).val('Please wait, loading...').attr('disabled',true);
		$.ajax ({
			type: "POST",
			url: serverURL + '/tx/send',
			data: {'rawtx':$("#rawTransaction").val()},
			dataType: "json",
			error: function(data) {
				$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(" There was an error submitting your request, please try signing/submitting again\n " + JSON.stringify(data)).prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
			},
            success: function(data) {
            	var returnInfo = JSON.stringify(data);
            	console.log("returned: " + returnInfo);
					$("#rawTransactionStatus").addClass('alert-success').removeClass('alert-danger').removeClass('hidden');
            		$("#rawTransactionStatus").html('txid: '+returnInfo.slice(9,38)+'<br>'+ returnInfo.slice(39,66) +'<br>'+returnInfo.slice(67,73));
            		navigator.notification.beep(1);
			},
			complete: function(data, status) {
				$("#rawTransactionStatus").fadeOut().fadeIn();
				$(thisbtn).val('Submit').attr('disabled',false);
			}
		});
	app.sliceAndWrite64(deviceCommands.scan_wallet);
	currentCommand = '';
	}

});

