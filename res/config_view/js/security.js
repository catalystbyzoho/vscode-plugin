/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable func-names */
//$Id$

/**
 *@author patrick-2626
 *
 *wiki : https://intranet.wiki.zoho.com/security/securityjs.html
 *
 *Reference
 *  1)https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/
 *  2)https://github.com/danielstjules/blankshield
 */
'use strict'; // No I18N

if (!window.ZSEC) {
	Object.defineProperty(window, 'ZSEC', {
		// No I18N
		value: {},
		writable: false,
		configurable: false,
		enumerable: false
	});
}
Object.defineProperty(ZSEC, 'util', {
	// No I18N
	value: {},
	writable: false,
	configurable: false,
	enumerable: false
});

/**
 * polyfill
 * */

/**
 * below function will define Object.defineProperty if not defined.
 * Normal property addition through assignment(=) creates properties. But it show up during property enumeration (for...in loop or Object.keys method), whose values may be changed or deleted.
 * And it may even create some unusual behaviour
 * The Object.defineProperty method allows three extra details(configurable,writable, and enumerable) to be set for the value. By default all the value are true.
 * since defineProperty is not supported below IE-9 we have implemented fallback to directly assign value to the object
 * */

(function () {
	if (
		!Object.defineProperty ||
		!(function () {
			try {
				Object.defineProperty({}, 'x', {}); // No I18N
				return true;
			} catch (e) {
				return false;
			}
		})()
	) {
		var orig = Object.defineProperty;
		Object.defineProperty = function (o, prop, desc) {
			// IE8 supports Object.defineProperty but only to be used on DOM objects. Using the same for native objects throws an error. hence trying built-in implementation if there are no exception.

			if (orig) {
				try {
					return orig(o, prop, desc);
				} catch (e) {}
			}

			if (o !== Object(o)) {
				throw TypeError('Object.defineProperty called on non-object'); // No I18N
			}
			if (Object.prototype.__defineGetter__ && 'get' in desc) {
				// No I18N
				Object.prototype.__defineGetter__.call(o, prop, desc.get);
			}
			if (Object.prototype.__defineSetter__ && 'set' in desc) {
				// No I18N
				Object.prototype.__defineSetter__.call(o, prop, desc.set);
			}
			if ('value' in desc) {
				// No I18N
				o[prop] = desc.value;
			}
			return o;
		};
	}
})();

/**
 * it's a wrapper over Object.defineProperty for setting  data descriptors for object .A data descriptor is a property that has a value, which sets isWritable,isConfigurable,isEnumerable for an object. By default all configuration values are false.
 *
 * @param   {Object} obj
 * @param   {string} property
 * @param   {value}  value
 * @param   {boolean}  isOverrideDefaultValue
 * @param   {boolean}  isWritable
 * @param   {boolean}  isConfigurable
 * @param   {boolean}  isEnumerable
 * @returns {Object}
 */

ZSEC.util.defineProperty = function ZSECDefineProperty(
	obj,
	property,
	value,
	isOverrideDefaultValue,
	isWritable,
	isConfigurable,
	isEnumerable
) {
	if (!isOverrideDefaultValue && property in obj) {
		return;
	}
	isWritable = isWritable == true;
	isConfigurable = isConfigurable == true;
	isEnumerable = isEnumerable == true;
	return Object.defineProperty(obj, property, {
		value: value,
		writable: isWritable,
		configurable: isConfigurable,
		enumerable: isEnumerable
	});
};

//initializing ZSEC values
ZSEC.util.defineProperty(ZSEC, 'version', '2.0', true); // No I18N
ZSEC.util.defineProperty(ZSEC, 'constants', ZSEC.constants || {}, true); // No I18N

/**
 * Array.indexOf function is not supported below IE-9 .
 * since defineProperty also is not supported below IE-9, And since there are many use cases where service teams are using property enumeration (for...in loop) for Arrays (which is not recommended)
 * the Array.indexOf function is stored in the variable(ZSEC.util.ArrayIndexOf) instead of assigning it directly to Array.prototype. And later it is called using ZSEC.util.ArrayIndexOf.call(params...)
 * */
ZSEC.util.ArrayIndexOf = Array.prototype.indexOf;
if (!ZSEC.util.ArrayIndexOf) {
	ZSEC.util.ArrayIndexOf = function (searchElement) {
		if (this === void 0 || this === null) {
			throw TypeError();
		}

		var t = Object(this);
		var len = t.length >>> 0;
		if (len === 0) {
			return -1;
		}

		var n = 0;
		if (arguments.length > 0) {
			n = Number(arguments[1]);
			if (isNaN(n)) {
				n = 0;
			} else if (n !== 0 && n !== 1 / 0 && n !== -(1 / 0)) {
				n = (n > 0 || -1) * Math.floor(Math.abs(n));
			}
		}

		if (n >= len) {
			return -1;
		}

		var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);

		for (; k < len; k++) {
			if (k in t && t.charAt(k) === searchElement) {
				return k;
			}
		}
		return -1;
	};
}

/**
 * defining String.prototype.codePointAt if not defined already
 * Which is not supported bellow IE-11
 *
 */

if (!String.prototype.codePointAt) {
	var codePointAt = function (position) {
		if (this == null) {
			throw TypeError();
		}
		var string = String(this);
		var size = string.length;
		// `ToInteger`
		var index = position ? Number(position) : 0;
		if (index != index) {
			// better `isNaN`
			index = 0;
		}
		// Account for out-of-bounds indices:
		if (index < 0 || index >= size) {
			return undefined;
		}
		// Get the first code unit
		var first = string.charCodeAt(index);
		var second;
		if (
			// check if it’s the start of a surrogate pair
			first >= 0xd800 &&
			first <= 0xdbff && // high surrogate
			size > index + 1 // there is a next code unit
		) {
			second = string.charCodeAt(index + 1);
			if (second >= 0xdc00 && second <= 0xdfff) {
				// low surrogate
				// https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
				return (first - 0xd800) * 0x400 + second - 0xdc00 + 0x10000;
			}
		}
		return first;
	};
	ZSEC.util.defineProperty(String.prototype, 'codePointAt', codePointAt, false); // No I18N
} else {
	ZSEC.util.defineProperty(String.prototype, 'codePointAt', String.prototype.codePointAt, true); // No I18N
}

/**
 * defining String.fromCodePoint if not defined already
 * Which is not supported in many browsers like IE ,Android ,Opera Mobile
 * */

if (!String.fromCodePoint) {
	var stringFromCharCode = String.fromCharCode;
	var floor = Math.floor;
	var fromCodePoint = function () {
		var MAX_SIZE = 0x4000;
		var codeUnits = [];
		var highSurrogate;
		var lowSurrogate;
		var index = -1;
		var length = arguments.length;
		if (!length) {
			return ''; // No I18N
		}
		var result = ''; // No I18N
		while (++index < length) {
			var codePoint = Number(arguments[index]);
			if (
				!isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity`
				codePoint < 0 || // not a valid Unicode code point
				codePoint > 0x10ffff || // not a valid Unicode code point
				floor(codePoint) != codePoint // not an integer
			) {
				throw RangeError('Invalid code point: ' + codePoint); // No I18N
			}
			if (codePoint <= 0xffff) {
				// BMP code point
				codeUnits.push(codePoint);
			} else {
				// Astral code point; split in surrogate halves
				// http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
				codePoint -= 0x10000;
				highSurrogate = (codePoint >> 10) + 0xd800;
				lowSurrogate = (codePoint % 0x400) + 0xdc00;
				codeUnits.push(highSurrogate, lowSurrogate);
			}
			if (index + 1 == length || codeUnits.length > MAX_SIZE) {
				result += stringFromCharCode.apply(null, codeUnits);
				codeUnits.length = 0;
			}
		}
		return result;
	};
	ZSEC.util.defineProperty(String, 'fromCodePoint', fromCodePoint, false); // No I18N
} else {
	ZSEC.util.defineProperty(String, 'fromCodePoint', String.fromCodePoint, true); // No I18N
}

/**
 * Encoder
 * */
(function (encoder) {
	var entityToCharacterMap = {};
	entityToCharacterMap['&quot'] = '34'; /* 34 : quotation mark */ // No I18N
	entityToCharacterMap['&amp'] = '38'; /* 38 : ampersand */ // No I18N
	entityToCharacterMap['&lt'] = '60'; /* 60 : less-than sign */ // No I18N
	entityToCharacterMap['&gt'] = '62'; /* 62 : greater-than sign */ // No I18N
	entityToCharacterMap['&nbsp'] = '160'; /* 160 : no-break space */ // No I18N
	entityToCharacterMap['&iexcl'] = '161'; /* 161 : inverted exclamation mark */ // No I18N
	entityToCharacterMap['&cent'] = '162'; /* 162  : cent sign */ // No I18N
	entityToCharacterMap['&pound'] = '163'; /* 163  : pound sign */ // No I18N
	entityToCharacterMap['&curren'] = '164'; /* 164  : currency sign */ // No I18N
	entityToCharacterMap['&yen'] = '165'; /* 165  : yen sign */ // No I18N
	entityToCharacterMap['&brvbar'] = '166'; /* 166  : broken bar */ // No I18N
	entityToCharacterMap['&sect'] = '167'; /* 167  : section sign */ // No I18N
	entityToCharacterMap['&uml'] = '168'; /* 168  : diaeresis */ // No I18N
	entityToCharacterMap['&copy'] = '169'; /* 169  : copyright sign */ // No I18N
	entityToCharacterMap['&ordf'] = '170'; /* 170  : feminine ordinal indicator */ // No I18N
	entityToCharacterMap['&laquo'] = '171'; /* 171 : left-pointing double angle quotation mark */ // No I18N
	entityToCharacterMap['&not'] = '172'; /* 172  : not sign */ // No I18N
	entityToCharacterMap['&shy'] = '173'; /* 173  : soft hyphen */ // No I18N
	entityToCharacterMap['&reg'] = '174'; /* 174  : registered sign */ // No I18N
	entityToCharacterMap['&macr'] = '175'; /* 175  : macron */ // No I18N
	entityToCharacterMap['&deg'] = '176'; /* 176  : degree sign */ // No I18N
	entityToCharacterMap['&plusmn'] = '177'; /* 177 : plus-minus sign */ // No I18N
	entityToCharacterMap['&sup2'] = '178'; /* 178  : superscript two */ // No I18N
	entityToCharacterMap['&sup3'] = '179'; /* 179  : superscript three */ // No I18N
	entityToCharacterMap['&acute'] = '180'; /* 180  : acute accent */ // No I18N
	entityToCharacterMap['&micro'] = '181'; /* 181  : micro sign */ // No I18N
	entityToCharacterMap['&para'] = '182'; /* 182  : pilcrow sign */ // No I18N
	entityToCharacterMap['&middot'] = '183'; /* 183  : middle dot */ // No I18N
	entityToCharacterMap['&cedil'] = '184'; /* 184  : cedilla */ // No I18N
	entityToCharacterMap['&sup1'] = '185'; /* 185  : superscript one */ // No I18N
	entityToCharacterMap['&ordm'] = '186'; /* 186  : masculine ordinal indicator */ // No I18N
	entityToCharacterMap['&raquo'] = '187'; /* 187 : right-pointing double angle quotation mark */ // No I18N
	entityToCharacterMap['&frac14'] = '188'; /* 188  : vulgar fraction one quarter */ // No I18N
	entityToCharacterMap['&frac12'] = '189'; /* 189  : vulgar fraction one half */ // No I18N
	entityToCharacterMap['&frac34'] = '190'; /* 190  : vulgar fraction three quarters */ // No I18N
	entityToCharacterMap['&iquest'] = '191'; /* 191  : inverted question mark */ // No I18N
	entityToCharacterMap['&Agrave'] = '192'; /* 192  : Latin capital letter a with grave */ // No I18N
	entityToCharacterMap['&Aacute'] = '193'; /* 193  : Latin capital letter a with acute */ // No I18N
	entityToCharacterMap['&Acirc'] = '194'; /* 194  : Latin capital letter a with circumflex */ // No I18N
	entityToCharacterMap['&Atilde'] = '195'; /* 195  : Latin capital letter a with tilde */ // No I18N
	entityToCharacterMap['&Auml'] = '196'; /* 196  : Latin capital letter a with diaeresis */ // No I18N
	entityToCharacterMap['&Aring'] = '197'; /* 197  : Latin capital letter a with ring above */ // No I18N
	entityToCharacterMap['&AElig'] = '198'; /* 198  : Latin capital letter ae */ // No I18N
	entityToCharacterMap['&Ccedil'] = '199'; /* 199  : Latin capital letter c with cedilla */ // No I18N
	entityToCharacterMap['&Egrave'] = '200'; /* 200  : Latin capital letter e with grave */ // No I18N
	entityToCharacterMap['&Eacute'] = '201'; /* 201  : Latin capital letter e with acute */ // No I18N
	entityToCharacterMap['&Ecirc'] = '202'; /* 202  : Latin capital letter e with circumflex */ // No I18N
	entityToCharacterMap['&Euml'] = '203'; /* 203  : Latin capital letter e with diaeresis */ // No I18N
	entityToCharacterMap['&Igrave'] = '204'; /* 204  : Latin capital letter i with grave */ // No I18N
	entityToCharacterMap['&Iacute'] = '205'; /* 205  : Latin capital letter i with acute */ // No I18N
	entityToCharacterMap['&Icirc'] = '206'; /* 206  : Latin capital letter i with circumflex */ // No I18N
	entityToCharacterMap['&Iuml'] = '207'; /* 207  : Latin capital letter i with diaeresis */ // No I18N
	entityToCharacterMap['&ETH'] = '208'; /* 208  : Latin capital letter eth */ // No I18N
	entityToCharacterMap['&Ntilde'] = '209'; /* 209  : Latin capital letter n with tilde */ // No I18N
	entityToCharacterMap['&Ograve'] = '210'; /* 210  : Latin capital letter o with grave */ // No I18N
	entityToCharacterMap['&Oacute'] = '211'; /* 211  : Latin capital letter o with acute */ // No I18N
	entityToCharacterMap['&Ocirc'] = '212'; /* 212 : Latin capital letter o with circumflex */ // No I18N
	entityToCharacterMap['&Otilde'] = '213'; /* 213 : Latin capital letter o with tilde */ // No I18N
	entityToCharacterMap['&Ouml'] = '214'; /* 214 : Latin capital letter o with diaeresis */ // No I18N
	entityToCharacterMap['&times'] = '215'; /* 215 : multiplication sign */ // No I18N
	entityToCharacterMap['&Oslash'] = '216'; /* 216 : Latin capital letter o with stroke */ // No I18N
	entityToCharacterMap['&Ugrave'] = '217'; /* 217 : Latin capital letter u with grave */ // No I18N
	entityToCharacterMap['&Uacute'] = '218'; /* 218 : Latin capital letter u with acute */ // No I18N
	entityToCharacterMap['&Ucirc'] = '219'; /* 219 : Latin capital letter u with circumflex */ // No I18N
	entityToCharacterMap['&Uuml'] = '220'; /* 220 : Latin capital letter u with diaeresis */ // No I18N
	entityToCharacterMap['&Yacute'] = '221'; /* 221 : Latin capital letter y with acute */ // No I18N
	entityToCharacterMap['&THORN'] = '222'; /* 222 : Latin capital letter thorn */ // No I18N
	entityToCharacterMap['&szlig'] = '223'; /* 223 : Latin small letter sharp s, German Eszett */ // No I18N
	entityToCharacterMap['&agrave'] = '224'; /* 224 : Latin small letter a with grave */ // No I18N
	entityToCharacterMap['&aacute'] = '225'; /* 225 : Latin small letter a with acute */ // No I18N
	entityToCharacterMap['&acirc'] = '226'; /* 226 : Latin small letter a with circumflex */ // No I18N
	entityToCharacterMap['&atilde'] = '227'; /* 227 : Latin small letter a with tilde */ // No I18N
	entityToCharacterMap['&auml'] = '228'; /* 228 : Latin small letter a with diaeresis */ // No I18N
	entityToCharacterMap['&aring'] = '229'; /* 229 : Latin small letter a with ring above */ // No I18N
	entityToCharacterMap['&aelig'] = '230'; /* 230 : Latin lowercase ligature ae */ // No I18N
	entityToCharacterMap['&ccedil'] = '231'; /* 231 : Latin small letter c with cedilla */ // No I18N
	entityToCharacterMap['&egrave'] = '232'; /* 232 : Latin small letter e with grave */ // No I18N
	entityToCharacterMap['&eacute'] = '233'; /* 233 : Latin small letter e with acute */ // No I18N
	entityToCharacterMap['&ecirc'] = '234'; /* 234 : Latin small letter e with circumflex */ // No I18N
	entityToCharacterMap['&euml'] = '235'; /* 235 : Latin small letter e with diaeresis */ // No I18N
	entityToCharacterMap['&igrave'] = '236'; /* 236 : Latin small letter i with grave */ // No I18N
	entityToCharacterMap['&iacute'] = '237'; /* 237 : Latin small letter i with acute */ // No I18N
	entityToCharacterMap['&icirc'] = '238'; /* 238 : Latin small letter i with circumflex */ // No I18N
	entityToCharacterMap['&iuml'] = '239'; /* 239 : Latin small letter i with diaeresis */ // No I18N
	entityToCharacterMap['&eth'] = '240'; /* 240 : Latin small letter eth */ // No I18N
	entityToCharacterMap['&ntilde'] = '241'; /* 241 : Latin small letter n with tilde */ // No I18N
	entityToCharacterMap['&ograve'] = '242'; /* 242 : Latin small letter o with grave */ // No I18N
	entityToCharacterMap['&oacute'] = '243'; /* 243 : Latin small letter o with acute */ // No I18N
	entityToCharacterMap['&ocirc'] = '244'; /* 244 : Latin small letter o with circumflex */ // No I18N
	entityToCharacterMap['&otilde'] = '245'; /* 245 : Latin small letter o with tilde */ // No I18N
	entityToCharacterMap['&ouml'] = '246'; /* 246 : Latin small letter o with diaeresis */ // No I18N
	entityToCharacterMap['&divide'] = '247'; /* 247 : division sign */ // No I18N
	entityToCharacterMap['&oslash'] = '248'; /* 248 : Latin small letter o with stroke */ // No I18N
	entityToCharacterMap['&ugrave'] = '249'; /* 249 : Latin small letter u with grave */ // No I18N
	entityToCharacterMap['&uacute'] = '250'; /* 250 : Latin small letter u with acute */ // No I18N
	entityToCharacterMap['&ucirc'] = '251'; /* 251 : Latin small letter u with circumflex */ // No I18N
	entityToCharacterMap['&uuml'] = '252'; /* 252 : Latin small letter u with diaeresis */ // No I18N
	entityToCharacterMap['&yacute'] = '253'; /* 253 : Latin small letter y with acute */ // No I18N
	entityToCharacterMap['&thorn'] = '254'; /* 254 : Latin small letter thorn */ // No I18N
	entityToCharacterMap['&yuml'] = '255'; /* 255 : Latin small letter y with diaeresis */ // No I18N
	entityToCharacterMap['&OElig'] = '338'; /* 338 : Latin capital ligature oe */ // No I18N
	entityToCharacterMap['&oelig'] = '339'; /* 339 : Latin small ligature oe */ // No I18N
	entityToCharacterMap['&Scaron'] = '352'; /* 352 : Latin capital letter s with caron */ // No I18N
	entityToCharacterMap['&scaron'] = '353'; /* 353 : Latin small letter s with caron */ // No I18N
	entityToCharacterMap['&Yuml'] = '376'; /* 376 : Latin capital letter y with diaeresis */ // No I18N
	entityToCharacterMap['&fnof'] = '402'; /* 402 : Latin small letter f with hook */ // No I18N
	entityToCharacterMap['&circ'] = '710'; /* 710 : modifier letter circumflex accent */ // No I18N
	entityToCharacterMap['&tilde'] = '732'; /* 732 : small tilde */ // No I18N
	entityToCharacterMap['&Alpha'] = '913'; /* 913 : Greek capital letter alpha */ // No I18N
	entityToCharacterMap['&Beta'] = '914'; /* 914 : Greek capital letter beta */ // No I18N
	entityToCharacterMap['&Gamma'] = '915'; /* 915 : Greek capital letter gamma */ // No I18N
	entityToCharacterMap['&Delta'] = '916'; /* 916 : Greek capital letter delta */ // No I18N
	entityToCharacterMap['&Epsilon'] = '917'; /* 917 : Greek capital letter epsilon */ // No I18N
	entityToCharacterMap['&Zeta'] = '918'; /* 918 : Greek capital letter zeta */ // No I18N
	entityToCharacterMap['&Eta'] = '919'; /* 919 : Greek capital letter eta */ // No I18N
	entityToCharacterMap['&Theta'] = '920'; /* 920 : Greek capital letter theta */ // No I18N
	entityToCharacterMap['&Iota'] = '921'; /* 921 : Greek capital letter iota */ // No I18N
	entityToCharacterMap['&Kappa'] = '922'; /* 922 : Greek capital letter kappa */ // No I18N
	entityToCharacterMap['&Lambda'] = '923'; /* 923 : Greek capital letter lambda */ // No I18N
	entityToCharacterMap['&Mu'] = '924'; /* 924 : Greek capital letter mu */ // No I18N
	entityToCharacterMap['&Nu'] = '925'; /* 925 : Greek capital letter nu */ // No I18N
	entityToCharacterMap['&Xi'] = '926'; /* 926 : Greek capital letter xi */ // No I18N
	entityToCharacterMap['&Omicron'] = '927'; /* 927 : Greek capital letter omicron */ // No I18N
	entityToCharacterMap['&Pi'] = '928'; /* 928 : Greek capital letter pi */ // No I18N
	entityToCharacterMap['&Rho'] = '929'; /* 929 : Greek capital letter rho */ // No I18N
	entityToCharacterMap['&Sigma'] = '931'; /* 931 : Greek capital letter sigma */ // No I18N
	entityToCharacterMap['&Tau'] = '932'; /* 932 : Greek capital letter tau */ // No I18N
	entityToCharacterMap['&Upsilon'] = '933'; /* 933 : Greek capital letter upsilon */ // No I18N
	entityToCharacterMap['&Phi'] = '934'; /* 934 : Greek capital letter phi */ // No I18N
	entityToCharacterMap['&Chi'] = '935'; /* 935 : Greek capital letter chi */ // No I18N
	entityToCharacterMap['&Psi'] = '936'; /* 936 : Greek capital letter psi */ // No I18N
	entityToCharacterMap['&Omega'] = '937'; /* 937 : Greek capital letter omega */ // No I18N
	entityToCharacterMap['&alpha'] = '945'; /* 945 : Greek small letter alpha */ // No I18N
	entityToCharacterMap['&beta'] = '946'; /* 946 : Greek small letter beta */ // No I18N
	entityToCharacterMap['&gamma'] = '947'; /* 947 : Greek small letter gamma */ // No I18N
	entityToCharacterMap['&delta'] = '948'; /* 948 : Greek small letter delta */ // No I18N
	entityToCharacterMap['&epsilon'] = '949'; /* 949 : Greek small letter epsilon */ // No I18N
	entityToCharacterMap['&zeta'] = '950'; /* 950 : Greek small letter zeta */ // No I18N
	entityToCharacterMap['&eta'] = '951'; /* 951 : Greek small letter eta */ // No I18N
	entityToCharacterMap['&theta'] = '952'; /* 952 : Greek small letter theta */ // No I18N
	entityToCharacterMap['&iota'] = '953'; /* 953 : Greek small letter iota */ // No I18N
	entityToCharacterMap['&kappa'] = '954'; /* 954 : Greek small letter kappa */ // No I18N
	entityToCharacterMap['&lambda'] = '955'; /* 955 : Greek small letter lambda */ // No I18N
	entityToCharacterMap['&mu'] = '956'; /* 956 : Greek small letter mu */ // No I18N
	entityToCharacterMap['&nu'] = '957'; /* 957 : Greek small letter nu */ // No I18N
	entityToCharacterMap['&xi'] = '958'; /* 958 : Greek small letter xi */ // No I18N
	entityToCharacterMap['&omicron'] = '959'; /* 959 : Greek small letter omicron */ // No I18N
	entityToCharacterMap['&pi'] = '960'; /* 960 : Greek small letter pi */ // No I18N
	entityToCharacterMap['&rho'] = '961'; /* 961 : Greek small letter rho */ // No I18N
	entityToCharacterMap['&sigmaf'] = '962'; /* 962 : Greek small letter final sigma */ // No I18N
	entityToCharacterMap['&sigma'] = '963'; /* 963 : Greek small letter sigma */ // No I18N
	entityToCharacterMap['&tau'] = '964'; /* 964 : Greek small letter tau */ // No I18N
	entityToCharacterMap['&upsilon'] = '965'; /* 965 : Greek small letter upsilon */ // No I18N
	entityToCharacterMap['&phi'] = '966'; /* 966 : Greek small letter phi */ // No I18N
	entityToCharacterMap['&chi'] = '967'; /* 967 : Greek small letter chi */ // No I18N
	entityToCharacterMap['&psi'] = '968'; /* 968 : Greek small letter psi */ // No I18N
	entityToCharacterMap['&omega'] = '969'; /* 969 : Greek small letter omega */ // No I18N
	entityToCharacterMap['&thetasym'] = '977'; /* 977 : Greek theta symbol */ // No I18N
	entityToCharacterMap['&upsih'] = '978'; /* 978 : Greek upsilon with hook symbol */ // No I18N
	entityToCharacterMap['&piv'] = '982'; /* 982 : Greek pi symbol */ // No I18N
	entityToCharacterMap['&ensp'] = '8194'; /* 8194 : en space */ // No I18N
	entityToCharacterMap['&emsp'] = '8195'; /* 8195 : em space */ // No I18N
	entityToCharacterMap['&thinsp'] = '8201'; /* 8201 : thin space */ // No I18N
	entityToCharacterMap['&zwnj'] = '8204'; /* 8204 : zero width non-joiner */ // No I18N
	entityToCharacterMap['&zwj'] = '8205'; /* 8205 : zero width joiner */ // No I18N
	entityToCharacterMap['&lrm'] = '8206'; /* 8206 : left-to-right mark */ // No I18N
	entityToCharacterMap['&rlm'] = '8207'; /* 8207 : right-to-left mark */ // No I18N
	entityToCharacterMap['&ndash'] = '8211'; /* 8211 : en dash */ // No I18N
	entityToCharacterMap['&mdash'] = '8212'; /* 8212 : em dash */ // No I18N
	entityToCharacterMap['&lsquo'] = '8216'; /* 8216 : left single quotation mark */ // No I18N
	entityToCharacterMap['&rsquo'] = '8217'; /* 8217 : right single quotation mark */ // No I18N
	entityToCharacterMap['&sbquo'] = '8218'; /* 8218 : single low-9 quotation mark */ // No I18N
	entityToCharacterMap['&ldquo'] = '8220'; /* 8220 : left double quotation mark */ // No I18N
	entityToCharacterMap['&rdquo'] = '8221'; /* 8221 : right double quotation mark */ // No I18N
	entityToCharacterMap['&bdquo'] = '8222'; /* 8222 : double low-9 quotation mark */ // No I18N
	entityToCharacterMap['&dagger'] = '8224'; /* 8224 : dagger */ // No I18N
	entityToCharacterMap['&Dagger'] = '8225'; /* 8225 : double dagger */ // No I18N
	entityToCharacterMap['&bull'] = '8226'; /* 8226 : bullet */ // No I18N
	entityToCharacterMap['&hellip'] = '8230'; /* 8230 : horizontal ellipsis */ // No I18N
	entityToCharacterMap['&permil'] = '8240'; /* 8240 : per mille sign */ // No I18N
	entityToCharacterMap['&prime'] = '8242'; /* 8242 : prime */ // No I18N
	entityToCharacterMap['&Prime'] = '8243'; /* 8243 : double prime */ // No I18N
	entityToCharacterMap['&lsaquo'] = '8249'; /* 8249 : single left-pointing angle quotation mark */ // No I18N
	entityToCharacterMap['&rsaquo'] =
		'8250'; /* 8250 : single right-pointing angle quotation mark */ // No I18N
	entityToCharacterMap['&oline'] = '8254'; /* 8254 : overline */ // No I18N
	entityToCharacterMap['&frasl'] = '8260'; /* 8260 : fraction slash */ // No I18N
	entityToCharacterMap['&euro'] = '8364'; /* 8364 : euro sign */ // No I18N
	entityToCharacterMap['&image'] = '8465'; /* 8465 : black-letter capital i */ // No I18N
	entityToCharacterMap['&weierp'] = '8472'; /* 8472 : script capital p, Weierstrass p */ // No I18N
	entityToCharacterMap['&real'] = '8476'; /* 8476 : black-letter capital r */ // No I18N
	entityToCharacterMap['&trade'] = '8482'; /* 8482 : trademark sign */ // No I18N
	entityToCharacterMap['&alefsym'] = '8501'; /* 8501 : alef symbol */ // No I18N
	entityToCharacterMap['&larr'] = '8592'; /* 8592 : leftwards arrow */ // No I18N
	entityToCharacterMap['&uarr'] = '8593'; /* 8593 : upwards arrow */ // No I18N
	entityToCharacterMap['&rarr'] = '8594'; /* 8594 : rightwards arrow */ // No I18N
	entityToCharacterMap['&darr'] = '8595'; /* 8595 : downwards arrow */ // No I18N
	entityToCharacterMap['&harr'] = '8596'; /* 8596 : left right arrow */ // No I18N
	entityToCharacterMap['&crarr'] = '8629'; /* 8629 : downwards arrow with corner leftwards */ // No I18N
	entityToCharacterMap['&lArr'] = '8656'; /* 8656 : leftwards double arrow */ // No I18N
	entityToCharacterMap['&uArr'] = '8657'; /* 8657 : upwards double arrow */ // No I18N
	entityToCharacterMap['&rArr'] = '8658'; /* 8658 : rightwards double arrow */ // No I18N
	entityToCharacterMap['&dArr'] = '8659'; /* 8659 : downwards double arrow */ // No I18N
	entityToCharacterMap['&hArr'] = '8660'; /* 8660 : left right double arrow */ // No I18N
	entityToCharacterMap['&forall'] = '8704'; /* 8704 : for all */ // No I18N
	entityToCharacterMap['&part'] = '8706'; /* 8706 : partial differential */ // No I18N
	entityToCharacterMap['&exist'] = '8707'; /* 8707 : there exists */ // No I18N
	entityToCharacterMap['&empty'] = '8709'; /* 8709 : empty set */ // No I18N
	entityToCharacterMap['&nabla'] = '8711'; /* 8711 : nabla */ // No I18N
	entityToCharacterMap['&isin'] = '8712'; /* 8712 : element of */ // No I18N
	entityToCharacterMap['&notin'] = '8713'; /* 8713 : not an element of */ // No I18N
	entityToCharacterMap['&ni'] = '8715'; /* 8715 : contains as member */ // No I18N
	entityToCharacterMap['&prod'] = '8719'; /* 8719 : n-ary product */ // No I18N
	entityToCharacterMap['&sum'] = '8721'; /* 8721 : n-ary summation */ // No I18N
	entityToCharacterMap['&minus'] = '8722'; /* 8722 : minus sign */ // No I18N
	entityToCharacterMap['&lowast'] = '8727'; /* 8727 : asterisk operator */ // No I18N
	entityToCharacterMap['&radic'] = '8730'; /* 8730 : square root */ // No I18N
	entityToCharacterMap['&prop'] = '8733'; /* 8733 : proportional to */ // No I18N
	entityToCharacterMap['&infin'] = '8734'; /* 8734 : infinity */ // No I18N
	entityToCharacterMap['&ang'] = '8736'; /* 8736 : angle */ // No I18N
	entityToCharacterMap['&and'] = '8743'; /* 8743 : logical and */ // No I18N
	entityToCharacterMap['&or'] = '8744'; /* 8744 : logical or */ // No I18N
	entityToCharacterMap['&cap'] = '8745'; /* 8745 : intersection */ // No I18N
	entityToCharacterMap['&cup'] = '8746'; /* 8746 : union */ // No I18N
	entityToCharacterMap['&int'] = '8747'; /* 8747 : integral */ // No I18N
	entityToCharacterMap['&there4'] = '8756'; /* 8756 : therefore */ // No I18N
	entityToCharacterMap['&sim'] = '8764'; /* 8764 : tilde operator */ // No I18N
	entityToCharacterMap['&cong'] = '8773'; /* 8773 : congruent to */ // No I18N
	entityToCharacterMap['&asymp'] = '8776'; /* 8776 : almost equal to */ // No I18N
	entityToCharacterMap['&ne'] = '8800'; /* 8800 : not equal to */ // No I18N
	entityToCharacterMap['&equiv'] = '8801'; /* 8801 : identical to, equivalent to */ // No I18N
	entityToCharacterMap['&le'] = '8804'; /* 8804 : less-than or equal to */ // No I18N
	entityToCharacterMap['&ge'] = '8805'; /* 8805 : greater-than or equal to */ // No I18N
	entityToCharacterMap['&sub'] = '8834'; /* 8834 : subset of */ // No I18N
	entityToCharacterMap['&sup'] = '8835'; /* 8835 : superset of */ // No I18N
	entityToCharacterMap['&nsub'] = '8836'; /* 8836 : not a subset of */ // No I18N
	entityToCharacterMap['&sube'] = '8838'; /* 8838 : subset of or equal to */ // No I18N
	entityToCharacterMap['&supe'] = '8839'; /* 8839 : superset of or equal to */ // No I18N
	entityToCharacterMap['&oplus'] = '8853'; /* 8853 : circled plus */ // No I18N
	entityToCharacterMap['&otimes'] = '8855'; /* 8855 : circled times */ // No I18N
	entityToCharacterMap['&perp'] = '8869'; /* 8869 : up tack */ // No I18N
	entityToCharacterMap['&sdot'] = '8901'; /* 8901 : dot operator */ // No I18N
	entityToCharacterMap['&lceil'] = '8968'; /* 8968 : left ceiling */ // No I18N
	entityToCharacterMap['&rceil'] = '8969'; /* 8969 : right ceiling */ // No I18N
	entityToCharacterMap['&lfloor'] = '8970'; /* 8970 : left floor */ // No I18N
	entityToCharacterMap['&rfloor'] = '8971'; /* 8971 : right floor */ // No I18N
	entityToCharacterMap['&lang'] = '10216'; /* 9001 : left-pointing angle bracket */ // No I18N
	entityToCharacterMap['&rang'] = '10217'; /* 9002 : right-pointing angle bracket */ // No I18N
	entityToCharacterMap['&loz'] = '9674'; /* 9674 : lozenge */ // No I18N
	entityToCharacterMap['&spades'] = '9824'; /* 9824 : black spade suit */ // No I18N
	entityToCharacterMap['&clubs'] = '9827'; /* 9827 : black club suit */ // No I18N
	entityToCharacterMap['&hearts'] = '9829'; /* 9829 : black heart suit */ // No I18N
	entityToCharacterMap['&diams'] = '9830'; /* 9830 : black diamond suit */ // No I18N
	var config = {
		entityToCharacterMap: entityToCharacterMap,
		IMMUNE_HTML: [',', '.', '-', '_', ' '], // No I18N
		IMMUNE_HTMLATTR: [',', '.', '-', '_'], // No I18N
		IMMUNE_CSS: [],
		IMMUNE_JAVASCRIPT: [',', '.', '_'] // No I18N
	};

	ZSEC.util.defineProperty(ZSEC, 'Encoder', encoder(config), true, false, false, true); // No I18N
})((config) => {
	var Encoder = {};
	var entityToCharacterMap = config.entityToCharacterMap;

	var characterToEntityMap = [];
	for (var entity in entityToCharacterMap) {
		characterToEntityMap[entityToCharacterMap[entity]] = entity;
	}

	var hex = [];
	for (var c = 0; c < 0xff; c++) {
		if ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) {
			hex[c] = null;
		} else {
			hex[c] = c.toString(16);
		}
	}

	var getHexForNonAlphanumeric = function (c) {
		if (c < 256) {
			return hex[c];
		}
		return c.toString(16);
	};

	var encodeHTMCharacter = function (aImmune, c) {
		if (ZSEC.util.ArrayIndexOf.call(aImmune, c) != -1) {
			return String.fromCodePoint(c);
		}
		var hex = getHexForNonAlphanumeric(c);
		if (hex == null) {
			return String.fromCodePoint(c);
		}

		// returning space for non printable characters
		if (
			(c <= 0x1f && c != '\t' && c != '\n' && c != '\r') ||
			(c >= 0x7f && c <= 0x9f) ||
			c == ' '
		) {
			// No I18N
			return ' '; // No I18N
		}

		var entityName = characterToEntityMap[c];
		if (entityName != null) {
			return entityName + ';'; // No I18N
		}

		return '&#x' + hex + ';'; // No I18N
	};

	var encodeJsCharacter = function (aImmune, c) {
		if (ZSEC.util.ArrayIndexOf.call(aImmune, c) != -1) {
			return String.fromCharCode(c);
		}
		var hex = getHexForNonAlphanumeric(c);
		if (hex == null) {
			return String.fromCharCode(c);
		}
		var tmp = c.toString(16);
		if (c < 256) {
			var pad = '00'.substr(tmp.length); // No I18N
			return '\\x' + pad + tmp.toUpperCase(); // No I18N
		}
		pad = '0000'.substr(tmp.length); // No I18N
		return '\\u' + pad + tmp.toUpperCase(); // No I18N
	};

	var encodeCssCharacter = function (aImmune, c) {
		if (ZSEC.util.ArrayIndexOf.call(aImmune, c) != -1) {
			return String.fromCodePoint(c);
		}

		var hex = getHexForNonAlphanumeric(c);
		if (hex == null) {
			return String.fromCodePoint(c);
		}

		return '\\' + hex + ' '; // No I18N
	};

	/**
	 * It iterate over the characters in sInput and calls characterEncoder to encode it. It iterate either by code unit or code point depend uppon the isHandleUnicodeChar value
	 * @param   {Array} aImmune -> immune character list
	 * @param   {String} sInput
	 * @param   {Function}  characterEncoder
	 * @param   {Boolean}  isHandleUnicodeChar -> if true iterate by codePoint
	 */
	function encode(aImmune, sInput, characterEncoder, isHandleUnicodeChar) {
		if (sInput == null || sInput == undefined || 'string' != typeof sInput) {
			// No I18N
			return sInput;
		}
		var out = ''; // No I18N
		for (var i = 0; i < sInput.length; i++) {
			if (isHandleUnicodeChar) {
				var c = sInput.codePointAt(i);
				out += characterEncoder(aImmune, c, isHandleUnicodeChar);
				if (c > 0xffff) {
					i++;
				}
			} else {
				out += characterEncoder(aImmune, sInput.charCodeAt(i));
			}
		}
		return out;
	}

	/**
	 * It encodes text which has to be rendered as element text, Here input has to be iterated by code point
	 *@param  {String} input
	 */
	Encoder.encodeForHTML = function encodeForHTML(input) {
		return encode(config.IMMUNE_HTML, input, encodeHTMCharacter, true);
	};

	/**
	 * It encodes text which has to be rendered as html attribute value(except attributes executes as js example onclick,onblur etc...), Here input has to be iterated by code point
	 *@param {String} input
	 */
	Encoder.encodeForHTMLAttribute = function encodeForHTMLAttribute(input) {
		return encode(config.IMMUNE_HTMLATTR, input, encodeHTMCharacter, true);
	};

	/**
	 * It encodes text which has to be rendered as value inside the script tag or html attribute which get executed as js(onclick,onblur etc...), Here input has to be iterated by code unit
	 *@param {String} inputtriggertrigger
	 */
	Encoder.encodeForJavaScript = function encodeForJavaScript(input) {
		return encode(config.IMMUNE_JAVASCRIPT, input, encodeJsCharacter, false);
	};

	/**
	 * It encodes text which has to be rendered as css property name or value, Here input has to be iterated by code unit
	 *@param {String} input
	 */
	Encoder.encodeForCSS = function encodeForCSS(input) {
		return encode(config.IMMUNE_CSS, input, encodeCssCharacter, true);
	};

	if (Object.freeze) {
		Object.freeze(Encoder);
	}
	return Encoder;
});

/**
 * DOMPurify
 **/
(function (factory) {
	window.DOMPurify = factory(window);
})(function factory(window) {
	'use strict'; // No I18N

	var DOMPurify = function (window) {
		return factory(window);
	};

	/**
	 * Version label, exposed for easier checks
	 * if DOMPurify is up to date or not
	 */
	DOMPurify.version = '0.8.5'; // No I18N

	/**
	 * Array of elements that DOMPurify removed during sanitation.
	 * Empty if nothing was removed.
	 */
	DOMPurify.removed = [];

	if (!window || !window.document || window.document.nodeType !== 9) {
		// not running in a browser, provide a factory function
		// so that you can pass your own Window
		DOMPurify.isSupported = false;
		return DOMPurify;
	}

	var useDOMParser = false; // See comment below
	var removeTitle = false; // See comment below

	var document = window.document;
	var originalDocument = document;
	var DocumentFragment = window.DocumentFragment;
	var HTMLTemplateElement = window.HTMLTemplateElement;
	var Node = window.Node;
	var NodeFilter = window.NodeFilter;
	var NamedNodeMap = window.NamedNodeMap || window.MozNamedAttrMap;
	var Text = window.Text;
	var Comment = window.Comment;
	var DOMParser = window.DOMParser;

	// As per issue #47, the web-components registry is inherited by a
	// new document created via createHTMLDocument. As per the spec
	// (http://w3c.github.io/webcomponents/spec/custom/#creating-and-passing-registries)
	// a new empty registry is used when creating a template contents owner
	// document, so we use that as our parent document to ensure nothing
	// is inherited.
	if (typeof HTMLTemplateElement === 'function') {
		// No I18N
		var template = document.createElement('template'); // No I18N
		if (template.content && template.content.ownerDocument) {
			document = template.content.ownerDocument;
		}
	}
	var implementation = document.implementation;
	var createNodeIterator = document.createNodeIterator;
	var getElementsByTagName = document.getElementsByTagName;
	var createDocumentFragment = document.createDocumentFragment;
	var importNode = originalDocument.importNode;

	var hooks = {};

	/**
	 * Expose whether this browser supports running the full DOMPurify.
	 */
	DOMPurify.isSupported =
		typeof implementation.createHTMLDocument !== 'undefined' && // No I18N
		document.documentMode !== 9;

	/* Add properties to a lookup table */
	var _addToSet = function (set, array) {
		var l = array.length;
		while (l--) {
			if (typeof array[l] === 'string') {
				// No I18N
				array[l] = array[l].toLowerCase();
			}
			set[array[l]] = true;
		}
		return set;
	};

	/* Shallow clone an object */
	var _cloneObj = function (object) {
		var newObject = {};
		var property;
		for (property in object) {
			if (object.hasOwnProperty(property)) {
				newObject[property] = object[property];
			}
		}
		return newObject;
	};

	/**
	 * We consider the elements and attributes below to be safe. Ideally
	 * don't add any new ones but feel free to remove unwanted ones.
	 */

	/* allowed element names */
	var ALLOWED_TAGS = null;
	var DEFAULT_ALLOWED_TAGS = _addToSet({}, [
		// HTML
		'a',
		'abbr',
		'acronym',
		'address',
		'area',
		'article',
		'aside',
		'audio',
		'b', // No I18N
		'bdi',
		'bdo',
		'big',
		'blink',
		'blockquote',
		'body',
		'br',
		'button',
		'canvas', // No I18N
		'caption',
		'center',
		'cite',
		'code',
		'col',
		'colgroup',
		'content',
		'data', // No I18N
		'datalist',
		'dd',
		'decorator',
		'del',
		'details',
		'dfn',
		'dir',
		'div',
		'dl',
		'dt', // No I18N
		'element',
		'em',
		'fieldset',
		'figcaption',
		'figure',
		'font',
		'footer',
		'form', // No I18N
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'head',
		'header',
		'hgroup',
		'hr',
		'html',
		'i', // No I18N
		'img',
		'input',
		'ins',
		'kbd',
		'label',
		'legend',
		'li',
		'main',
		'map',
		'mark', // No I18N
		'marquee',
		'menu',
		'menuitem',
		'meter',
		'nav',
		'nobr',
		'ol',
		'optgroup', // No I18N
		'option',
		'output',
		'p',
		'pre',
		'progress',
		'q',
		'rp',
		'rt',
		'ruby',
		's',
		'samp', // No I18N
		'section',
		'select',
		'shadow',
		'small',
		'source',
		'spacer',
		'span',
		'strike', // No I18N
		'strong',
		'style',
		'sub',
		'summary',
		'sup',
		'table',
		'tbody',
		'td',
		'template', // No I18N
		'textarea',
		'tfoot',
		'th',
		'thead',
		'time',
		'tr',
		'track',
		'tt',
		'u',
		'ul',
		'var', // No I18N
		'video',
		'wbr', // No I18N

		// SVG
		'svg',
		'altglyph',
		'altglyphdef',
		'altglyphitem',
		'animatecolor', // No I18N
		'animatemotion',
		'animatetransform',
		'circle',
		'clippath',
		'defs',
		'desc', // No I18N
		'ellipse',
		'filter',
		'font',
		'g',
		'glyph',
		'glyphref',
		'hkern',
		'image',
		'line', // No I18N
		'lineargradient',
		'marker',
		'mask',
		'metadata',
		'mpath',
		'path',
		'pattern', // No I18N
		'polygon',
		'polyline',
		'radialgradient',
		'rect',
		'stop',
		'switch',
		'symbol', // No I18N
		'text',
		'textpath',
		'title',
		'tref',
		'tspan',
		'view',
		'vkern', // No I18N

		// SVG Filters
		'feBlend',
		'feColorMatrix',
		'feComponentTransfer',
		'feComposite', // No I18N
		'feConvolveMatrix',
		'feDiffuseLighting',
		'feDisplacementMap', // No I18N
		'feFlood',
		'feFuncA',
		'feFuncB',
		'feFuncG',
		'feFuncR',
		'feGaussianBlur', // No I18N
		'feMerge',
		'feMergeNode',
		'feMorphology',
		'feOffset', // No I18N
		'feSpecularLighting',
		'feTile',
		'feTurbulence', // No I18N

		//MathML
		'math',
		'menclose',
		'merror',
		'mfenced',
		'mfrac',
		'mglyph',
		'mi',
		'mlabeledtr', // No I18N
		'mmuliscripts',
		'mn',
		'mo',
		'mover',
		'mpadded',
		'mphantom',
		'mroot',
		'mrow', // No I18N
		'ms',
		'mpspace',
		'msqrt',
		'mystyle',
		'msub',
		'msup',
		'msubsup',
		'mtable',
		'mtd', // No I18N
		'mtext',
		'mtr',
		'munder',
		'munderover', // No I18N

		//Text
		'#text' // No I18N
	]);

	/* Allowed attribute names */
	var ALLOWED_ATTR = null;
	var DEFAULT_ALLOWED_ATTR = _addToSet({}, [
		// HTML
		'accept',
		'action',
		'align',
		'alt',
		'autocomplete',
		'background',
		'bgcolor', // No I18N
		'border',
		'cellpadding',
		'cellspacing',
		'checked',
		'cite',
		'class',
		'clear',
		'color', // No I18N
		'cols',
		'colspan',
		'coords',
		'datetime',
		'default',
		'dir',
		'disabled', // No I18N
		'download',
		'enctype',
		'face',
		'for',
		'headers',
		'height',
		'hidden',
		'high',
		'href', // No I18N
		'hreflang',
		'id',
		'ismap',
		'label',
		'lang',
		'list',
		'loop',
		'low',
		'max', // No I18N
		'maxlength',
		'media',
		'method',
		'min',
		'multiple',
		'name',
		'noshade',
		'novalidate', // No I18N
		'nowrap',
		'open',
		'optimum',
		'pattern',
		'placeholder',
		'poster',
		'preload',
		'pubdate', // No I18N
		'radiogroup',
		'readonly',
		'rel',
		'required',
		'rev',
		'reversed',
		'role',
		'rows', // No I18N
		'rowspan',
		'spellcheck',
		'scope',
		'selected',
		'shape',
		'size',
		'span', // No I18N
		'srclang',
		'start',
		'src',
		'step',
		'style',
		'summary',
		'tabindex',
		'title', // No I18N
		'type',
		'usemap',
		'valign',
		'value',
		'width',
		'xmlns', // No I18N

		// SVG
		'accent-height',
		'accumulate',
		'additivive',
		'alignment-baseline', // No I18N
		'ascent',
		'attributename',
		'attributetype',
		'azimuth',
		'basefrequency', // No I18N
		'baseline-shift',
		'begin',
		'bias',
		'by',
		'clip',
		'clip-path',
		'clip-rule', // No I18N
		'color',
		'color-interpolation',
		'color-interpolation-filters',
		'color-profile', // No I18N
		'color-rendering',
		'cx',
		'cy',
		'd',
		'dx',
		'dy',
		'diffuseconstant',
		'direction', // No I18N
		'display',
		'divisor',
		'dur',
		'edgemode',
		'elevation',
		'end',
		'fill',
		'fill-opacity', // No I18N
		'fill-rule',
		'filter',
		'flood-color',
		'flood-opacity',
		'font-family',
		'font-size', // No I18N
		'font-size-adjust',
		'font-stretch',
		'font-style',
		'font-variant',
		'font-weight', // No I18N
		'fx',
		'fy',
		'g1',
		'g2',
		'glyph-name',
		'glyphref',
		'gradientunits',
		'gradienttransform', // No I18N
		'image-rendering',
		'in',
		'in2',
		'k',
		'k1',
		'k2',
		'k3',
		'k4',
		'kerning',
		'keypoints', // No I18N
		'keysplines',
		'keytimes',
		'lengthadjust',
		'letter-spacing',
		'kernelmatrix', // No I18N
		'kernelunitlength',
		'lighting-color',
		'local',
		'marker-end',
		'marker-mid', // No I18N
		'marker-start',
		'markerheight',
		'markerunits',
		'markerwidth',
		'maskcontentunits', // No I18N
		'maskunits',
		'max',
		'mask',
		'mode',
		'min',
		'numoctaves',
		'offset',
		'operator', // No I18N
		'opacity',
		'order',
		'orient',
		'orientation',
		'origin',
		'overflow',
		'paint-order', // No I18N
		'path',
		'pathlength',
		'patterncontentunits',
		'patterntransform',
		'patternunits', // No I18N
		'points',
		'preservealpha',
		'r',
		'rx',
		'ry',
		'radius',
		'refx',
		'refy',
		'repeatcount', // No I18N
		'repeatdur',
		'restart',
		'result',
		'rotate',
		'scale',
		'seed',
		'shape-rendering', // No I18N
		'specularconstant',
		'specularexponent',
		'spreadmethod',
		'stddeviation',
		'stitchtiles', // No I18N
		'stop-color',
		'stop-opacity',
		'stroke-dasharray',
		'stroke-dashoffset',
		'stroke-linecap', // No I18N
		'stroke-linejoin',
		'stroke-miterlimit',
		'stroke-opacity',
		'stroke',
		'stroke-width', // No I18N
		'surfacescale',
		'targetx',
		'targety',
		'transform',
		'text-anchor',
		'text-decoration', // No I18N
		'text-rendering',
		'textlength',
		'u1',
		'u2',
		'unicode',
		'values',
		'viewbox', // No I18N
		'visibility',
		'vert-adv-y',
		'vert-origin-x',
		'vert-origin-y',
		'word-spacing', // No I18N
		'wrap',
		'writing-mode',
		'xchannelselector',
		'ychannelselector',
		'x',
		'x1',
		'x2', // No I18N
		'y',
		'y1',
		'y2',
		'z',
		'zoomandpan', // No I18N

		// MathML
		'accent',
		'accentunder',
		'bevelled',
		'close',
		'columnsalign',
		'columnlines', // No I18N
		'columnspan',
		'denomalign',
		'depth',
		'display',
		'displaystyle',
		'fence', // No I18N
		'frame',
		'largeop',
		'length',
		'linethickness',
		'lspace',
		'lquote', // No I18N
		'mathbackground',
		'mathcolor',
		'mathsize',
		'mathvariant',
		'maxsize', // No I18N
		'minsize',
		'movablelimits',
		'notation',
		'numalign',
		'open',
		'rowalign', // No I18N
		'rowlines',
		'rowspacing',
		'rowspan',
		'rspace',
		'rquote',
		'scriptlevel', // No I18N
		'scriptminsize',
		'scriptsizemultiplier',
		'selection',
		'separator', // No I18N
		'separators',
		'stretchy',
		'subscriptshift',
		'supscriptshift',
		'symmetric', // No I18N
		'voffset', // No I18N

		// XML
		'xlink:href',
		'xml:id',
		'xlink:title',
		'xml:space',
		'xmlns:xlink' // No I18N
	]);

	/* Explicitly forbidden tags (overrides ALLOWED_TAGS/ADD_TAGS) */
	var FORBID_TAGS = null;

	/* Explicitly forbidden attributes (overrides ALLOWED_ATTR/ADD_ATTR) */
	var FORBID_ATTR = null;

	/* Decide if ARIA attributes are okay */
	var ALLOW_ARIA_ATTR = true;

	/* Decide if custom data attributes are okay */
	var ALLOW_DATA_ATTR = true;

	/* Decide if unknown protocols are okay */
	var ALLOW_UNKNOWN_PROTOCOLS = false;

	/* Output should be safe for jQuery's $() factory? */
	var SAFE_FOR_JQUERY = false;

	/* Output should be safe for common template engines.
	 * This means, DOMPurify removes data attributes, mustaches and ERB
	 */
	var SAFE_FOR_TEMPLATES = false;

	/* Specify template detection regex for SAFE_FOR_TEMPLATES mode */
	var MUSTACHE_EXPR = /\{\{[\s\S]*|[\s\S]*\}\}/gm;
	var ERB_EXPR = /<%[\s\S]*|[\s\S]*%>/gm;

	/* Decide if document with <html>... should be returned */
	var WHOLE_DOCUMENT = false;

	/* Decide if all elements (e.g. style, script) must be children of
	 * document.body. By default, browsers might move them to document.head */
	var FORCE_BODY = false;

	/* Decide if a DOM `HTMLBodyElement` should be returned, instead of a html string.
	 * If `WHOLE_DOCUMENT` is enabled a `HTMLHtmlElement` will be returned instead
	 */
	var RETURN_DOM = false;

	/* Decide if a DOM `DocumentFragment` should be returned, instead of a html string */
	var RETURN_DOM_FRAGMENT = false;

	/* If `RETURN_DOM` or `RETURN_DOM_FRAGMENT` is enabled, decide if the returned DOM
	 * `Node` is imported into the current `Document`. If this flag is not enabled the
	 * `Node` will belong (its ownerDocument) to a fresh `HTMLDocument`, created by
	 * DOMPurify. */
	var RETURN_DOM_IMPORT = false;

	/* Output should be free from DOM clobbering attacks? */
	var SANITIZE_DOM = true;

	/* Keep element content when removing element? */
	var KEEP_CONTENT = true;

	/* Tags to ignore content of when KEEP_CONTENT is true */
	var FORBID_CONTENTS = _addToSet({}, [
		'audio',
		'head',
		'math',
		'script',
		'style',
		'template',
		'svg',
		'video' // No I18N
	]);

	/* Tags that are safe for data: URIs */
	var DATA_URI_TAGS = _addToSet({}, [
		'audio',
		'video',
		'img',
		'source',
		'image' // No I18N
	]);

	/* Attributes safe for values like "javascript:" */ // No I18N
	var URI_SAFE_ATTRIBUTES = _addToSet({}, [
		'alt',
		'class',
		'for',
		'id',
		'label',
		'name',
		'pattern',
		'placeholder', // No I18N
		'summary',
		'title',
		'value',
		'style',
		'xmlns' // No I18N
	]);

	/* Keep a reference to config to pass to hooks */
	var CONFIG = null;

	/* Ideally, do not touch anything below this line */
	/* ______________________________________________ */

	var formElement = document.createElement('form'); // No I18N

	/**
	 * _parseConfig
	 *
	 * @param  optional config literal
	 */
	var _parseConfig = function (cfg) {
		/* Shield configuration object from tampering */
		if (typeof cfg !== 'object') {
			// No I18N
			cfg = {};
		}

		/* Set configuration parameters */
		ALLOWED_TAGS =
			'ALLOWED_TAGS' in cfg // No I18N
				? _addToSet({}, cfg.ALLOWED_TAGS)
				: DEFAULT_ALLOWED_TAGS;
		ALLOWED_ATTR =
			'ALLOWED_ATTR' in cfg // No I18N
				? _addToSet({}, cfg.ALLOWED_ATTR)
				: DEFAULT_ALLOWED_ATTR;
		FORBID_TAGS =
			'FORBID_TAGS' in cfg // No I18N
				? _addToSet({}, cfg.FORBID_TAGS)
				: {};
		FORBID_ATTR =
			'FORBID_ATTR' in cfg // No I18N
				? _addToSet({}, cfg.FORBID_ATTR)
				: {};
		ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false; // Default true
		ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false; // Default true
		ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false; // Default false
		SAFE_FOR_JQUERY = cfg.SAFE_FOR_JQUERY || false; // Default false
		SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false; // Default false
		WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false; // Default false
		RETURN_DOM = cfg.RETURN_DOM || false; // Default false
		RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false; // Default false
		RETURN_DOM_IMPORT = cfg.RETURN_DOM_IMPORT || false; // Default false
		FORCE_BODY = cfg.FORCE_BODY !== false; // Default true
		SANITIZE_DOM = cfg.SANITIZE_DOM !== false; // Default true
		KEEP_CONTENT = cfg.KEEP_CONTENT !== false; // Default true

		if (SAFE_FOR_TEMPLATES) {
			ALLOW_DATA_ATTR = false;
		}

		if (RETURN_DOM_FRAGMENT) {
			RETURN_DOM = true;
		}

		// /* Merge configuration parameters */
		// if (cfg.ADD_TAGS) {
		//     if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
		//         ALLOWED_TAGS = _cloneObj(ALLOWED_TAGS);
		//     }
		//     _addToSet(ALLOWED_TAGS, cfg.ADD_TAGS);
		// }
		// if (cfg.ADD_ATTR) {
		//     if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
		//         ALLOWED_ATTR = _cloneObj(ALLOWED_ATTR);
		//     }
		//     _addToSet(ALLOWED_ATTR, cfg.ADD_ATTR);
		// }

		if (cfg.ADD_URI_SAFE_ATTR) {
			_addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR);
		}

		/* Add #text in case KEEP_CONTENT is set to true */
		if (KEEP_CONTENT) {
			ALLOWED_TAGS['#text'] = true; // No I18N
		}

		/* Add html, head and body to ALLOWED_TAGS in case WHOLE_DOCUMENT is true */
		if (WHOLE_DOCUMENT) {
			_addToSet(ALLOWED_TAGS, ['html', 'head', 'body']); // No I18N
		}

		/* Add tbody to ALLOWED_TAGS in case tables are permitted, see #286 */
		if (ALLOWED_TAGS.table) {
			_addToSet(ALLOWED_TAGS, ['tbody']);
		}

		// Prevent further manipulation of configuration.
		// Not available in IE8, Safari 5, etc.
		if (Object && 'freeze' in Object) {
			// No I18N
			Object.freeze(cfg);
		}

		CONFIG = cfg;
	};

	/**
	 * _forceRemove
	 *
	 * @param  a DOM node
	 */
	var _forceRemove = function (node) {
		DOMPurify.removed.push({
			element: node
		});
		try {
			node.parentNode.removeChild(node);
		} catch (e) {
			node.outerHTML = ''; // No I18N
		}
	};

	/**
	 * _removeAttribute
	 *
	 * @param  an Attribute name
	 * @param  a DOM node
	 */
	var _removeAttribute = function (name, node) {
		try {
			DOMPurify.removed.push({
				attribute: node.getAttributeNode(name),
				from: node
			});
		} catch (err) {
			DOMPurify.removed.push({
				attribute: null,
				from: node
			});
		}
		node.removeAttribute(name);
	};

	/**
	 * _initDocument
	 *
	 * @param  a string of dirty markup
	 * @return a DOM, filled with the dirty markup
	 */
	var _initDocument = function (dirty) {
		/* Create a HTML document using DOMParser */
		var doc, body;

		if (FORCE_BODY) {
			dirty = '<remove></remove>' + dirty; // No I18N
		}

		/* Use DOMParser to workaround Firefox bug (see comment below) */
		if (useDOMParser) {
			try {
				doc = new DOMParser().parseFromString(dirty, 'text/html'); // No I18N
			} catch (e) {}
		}

		/* Remove title to fix an mXSS bug in older MS Edge */
		if (removeTitle) {
			addToSet(FORBID_TAGS, ['title']);
		}

		/* Some browsers throw, some browsers return null for the code above
           DOMParser with text/html support is only in very recent browsers.
           See #159 why the check here is extra-thorough */
		if (!doc || !doc.documentElement) {
			doc = implementation.createHTMLDocument(''); // No I18N
			body = doc.body;
			body.parentNode.removeChild(body.parentNode.firstElementChild);
			body.outerHTML = dirty;
		}

		/* Work on whole document or just its body */
		if (typeof doc.getElementsByTagName === 'function') {
			// No I18N
			return doc.getElementsByTagName(WHOLE_DOCUMENT ? 'html' : 'body')[0]; // No I18N
		}
		return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? 'html' : 'body')[0]; // No I18N
	};

	// Firefox uses a different parser for innerHTML rather than
	// DOMParser (see https://bugzilla.mozilla.org/show_bug.cgi?id=1205631)
	// which means that you *must* use DOMParser, otherwise the output may
	// not be safe if used in a document.write context later.
	//
	// So we feature detect the Firefox bug and use the DOMParser if necessary.
	//
	// MS Edge, in older versions, is affected by an mXSS behavior. The second
	// check tests for the behavior and fixes it if necessary.
	if (DOMPurify.isSupported) {
		(function () {
			try {
				var doc = _initDocument(
					'<svg><p><style><img src="</style><img src=x onerror=alert(1)//">'
				);
				if (doc.querySelector('svg img')) {
					useDOMParser = true;
				}
			} catch (err) {}
		})();
		(function () {
			try {
				var doc = _initDocument('<x/><title>&lt;/title&gt;&lt;img&gt;'); // No I18N
				if (doc.querySelector('title').textContent.match(/<\/title/)) {
					removeTitle = true;
				}
			} catch (err) {}
		})();
	}

	/**
	 * _createIterator
	 *
	 * @param  document/fragment to create iterator for
	 * @return iterator instance
	 */
	var _createIterator = function (root) {
		return createNodeIterator.call(
			root.ownerDocument || root,
			root,
			NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT,
			() => {
				return NodeFilter.FILTER_ACCEPT;
			},
			false
		);
	};

	/**
	 * _isClobbered
	 *
	 * @param  element to check for clobbering attacks
	 * @return true if clobbered, false if safe
	 */
	var _isClobbered = function (elm) {
		if (elm instanceof Text || elm instanceof Comment) {
			return false;
		}
		if (
			typeof elm.nodeName !== 'string' || // No I18N
			typeof elm.textContent !== 'string' || // No I18N
			typeof elm.removeChild !== 'function' || // No I18N
			!(elm.attributes instanceof NamedNodeMap) ||
			typeof elm.removeAttribute !== 'function' || // No I18N
			typeof elm.setAttribute !== 'function' // No I18N
		) {
			return true;
		}
		return false;
	};

	/**
	 * _isNode
	 *
	 * @param object to check whether it's a DOM node
	 * @return true is object is a DOM node
	 */
	var _isNode = function (obj) {
		return typeof Node === 'object'
			? obj instanceof Node
			: obj && // No I18N
					typeof obj === 'object' &&
					typeof obj.nodeType === 'number' && // No I18N
					typeof obj.nodeName === 'string'; // No I18N
	};

	/**
	 * _sanitizeElements
	 *
	 * @protect nodeName
	 * @protect textContent
	 * @protect removeChild
	 *
	 * @param   node to check for permission to exist
	 * @return  true if node was killed, false if left alive
	 */
	var _sanitizeElements = function (currentNode) {
		var tagName, content;
		/* Execute a hook if present */
		_executeHook('beforeSanitizeElements', currentNode, null); // No I18N

		/* Check if element is clobbered or can clobber */
		if (_isClobbered(currentNode)) {
			_forceRemove(currentNode);
			return true;
		}

		/* Now let's check the element's type and name */ // No I18N
		tagName = currentNode.nodeName.toLowerCase();

		/* Execute a hook if present */
		_executeHook('uponSanitizeElement', currentNode, {
			// No I18N
			tagName: tagName,
			allowedTags: ALLOWED_TAGS
		});

		/* Remove element if anything forbids its presence */
		if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
			/* Keep content except for black-listed elements */
			if (
				KEEP_CONTENT &&
				!FORBID_CONTENTS[tagName] &&
				typeof currentNode.insertAdjacentHTML === 'function'
			) {
				// No I18N
				try {
					currentNode.insertAdjacentHTML('AfterEnd', currentNode.innerHTML); // No I18N
				} catch (e) {}
			}
			_forceRemove(currentNode);
			return true;
		}

		//TODO: Study about effects of '<' and '{{}}' in styles to make this more safe! // No I18N
		if (tagName != 'style') {
			//This check is to prevent '<' from being encoded when used in style. // No I18N
			/* Convert markup to cover jQuery behavior */
			if (
				SAFE_FOR_JQUERY &&
				!currentNode.firstElementChild &&
				(!currentNode.content || !currentNode.content.firstElementChild) &&
				/</g.test(currentNode.textContent)
			) {
				DOMPurify.removed.push({
					element: currentNode.cloneNode()
				});
				if (currentNode.innerHTML) {
					currentNode.innerHTML = currentNode.innerHTML.replace(/</g, '&lt;'); // No I18N
				} else {
					currentNode.innerHTML = currentNode.textContent.replace(/</g, '&lt;'); // No I18N
				}
			}
			/* Sanitize element content to be template-safe */
			if (SAFE_FOR_TEMPLATES && currentNode.nodeType === 3) {
				/* Get the element's text content */
				content = currentNode.textContent;
				content = content.replace(MUSTACHE_EXPR, ' '); // No I18N
				content = content.replace(ERB_EXPR, ' '); // No I18N
				if (currentNode.textContent !== content) {
					DOMPurify.removed.push({
						element: currentNode.cloneNode()
					});
					currentNode.textContent = content;
				}
			}
		}

		/* Execute a hook if present */
		_executeHook('afterSanitizeElements', currentNode, null); // No I18N

		return false;
	};

	var DATA_ATTR = /^data-[\-\w.\u00B7-\uFFFF]/;
	var ARIA_ATTR = /^aria-[\-\w]+$/;
	var IS_ALLOWED_URI = /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;
	var IS_SCRIPT_OR_DATA = /^(?:\w+script|data):/i;
	/* This needs to be extensive thanks to Webkit/Blink's behavior */
	var ATTR_WHITESPACE = /[\x00-\x20\xA0\u1680\u180E\u2000-\u2029\u205f\u3000]/g;

	/**
	 * _sanitizeAttributes
	 *
	 * @protect attributes
	 * @protect nodeName
	 * @protect removeAttribute
	 * @protect setAttribute
	 *
	 * @param   node to sanitize
	 * @return  void
	 */
	var _sanitizeAttributes = function (currentNode) {
		var attr, name, value, lcName, idAttr, attributes, hookEvent, l;
		/* Execute a hook if present */
		_executeHook('beforeSanitizeAttributes', currentNode, null); // No I18N

		attributes = currentNode.attributes;

		/* Check if we have attributes; if not we might have a text node */
		if (!attributes) {
			return;
		}

		hookEvent = {
			attrName: '', // No I18N
			attrValue: '', // No I18N
			keepAttr: true,
			allowedAttributes: ALLOWED_ATTR
		};
		l = attributes.length;

		/* Go backwards over all attributes; safely remove bad ones */
		while (l--) {
			attr = attributes[l];
			name = attr.name;
			value = attr.value.trim();
			lcName = name.toLowerCase();

			/* Execute a hook if present */
			hookEvent.attrName = lcName;
			hookEvent.attrValue = value;
			hookEvent.keepAttr = true;
			_executeHook('uponSanitizeAttribute', currentNode, hookEvent); // No I18N
			value = hookEvent.attrValue;

			/* Remove attribute */
			// Safari (iOS + Mac), last tested v8.0.5, crashes if you try to
			// remove a "name" attribute from an <img> tag that has an "id" // No I18N
			// attribute at the time.
			if (
				lcName === 'name' && // No I18N
				currentNode.nodeName === 'IMG' &&
				attributes.id
			) {
				// No I18N
				idAttr = attributes.id;
				attributes = Array.prototype.slice.apply(attributes);
				_removeAttribute('id', currentNode); // No I18N
				_removeAttribute(name, currentNode);
				if (attributes.indexOf(idAttr) > l) {
					currentNode.setAttribute('id', idAttr.value); // No I18N
				}
			} else {
				// This avoids a crash in Safari v9.0 with double-ids.
				// The trick is to first set the id to be empty and then to
				// remove the attriubute
				if (name === 'id') {
					// No I18N
					currentNode.setAttribute(name, ''); // No I18N
				}
				_removeAttribute(name, currentNode);
			}

			/* Did the hooks approve of the attribute? */
			if (!hookEvent.keepAttr) {
				continue;
			}

			/* Make sure attribute cannot clobber */
			if (
				SANITIZE_DOM &&
				(lcName === 'id' || lcName === 'name') && // No I18N
				(value in document || value in formElement)
			) {
				continue;
			}

			/* Sanitize attribute content to be template-safe */
			if (SAFE_FOR_TEMPLATES) {
				value = value.replace(MUSTACHE_EXPR, ' '); // No I18N
				value = value.replace(ERB_EXPR, ' '); // No I18N
			}

			/* Allow valid data-* attributes: At least one character after "-" // No I18N
               (https://html.spec.whatwg.org/multipage/dom.html#embedding-custom-non-visible-data-with-the-data-*-attributes)
               XML-compatible (https://html.spec.whatwg.org/multipage/infrastructure.html#xml-compatible and http://www.w3.org/TR/xml/#d0e804)
               We don't need to check the value; it's always URI safe. */ // No I18N
			var emptyBlockFiller = false; //Hack-fix for git preventing empty blocks in code
			if (ALLOW_DATA_ATTR && DATA_ATTR.test(lcName)) {
				// This attribute is safe
				emptyBlockFiller = true;
			} else if (ALLOW_ARIA_ATTR && ARIA_ATTR.test(lcName)) {
				// This attribute is safe
				emptyBlockFiller = true;
			} else if (!ALLOWED_ATTR[lcName] || FORBID_ATTR[lcName]) {
				/* Otherwise, check the name is permitted */
				continue;
			} else if (URI_SAFE_ATTRIBUTES[lcName]) {
				/* Check value is safe. First, is attr inert? If so, is safe */
				// This attribute is safe
				emptyBlockFiller = true;
			} else if (IS_ALLOWED_URI.test(value.replace(ATTR_WHITESPACE, ''))) {
				/* Check no script, data or unknown possibly unsafe URI
               unless we know URI values are safe for that attribute */
				// No I18N
				// This attribute is safe
				emptyBlockFiller = true;
			} else if (
				/* Keep image data URIs alive if src/xlink:href is allowed */
				(lcName === 'src' || lcName === 'xlink:href') && // No I18N
				value.indexOf('data:') === 0 && // No I18N
				DATA_URI_TAGS[currentNode.nodeName.toLowerCase()]
			) {
				// This attribute is safe
				emptyBlockFiller = true;
			} else if (
				/* Allow unknown protocols: This provides support for links that
               are handled by protocol handlers which may be unknown ahead of
               time, e.g. fb:, spotify: */
				ALLOW_UNKNOWN_PROTOCOLS &&
				!IS_SCRIPT_OR_DATA.test(value.replace(ATTR_WHITESPACE, ''))
			) {
				// No I18N
				// This attribute is safe
				emptyBlockFiller = true;
			} else if (!value) {
				/* Check for binary attributes */
				// binary attributes are safe at this point
				emptyBlockFiller = true;
			} else {
				/* Anything else, presume unsafe, do not add it back */
				continue;
			}

			/* Handle invalid data-* attribute set by try-catching it */
			try {
				currentNode.setAttribute(name, value);
				DOMPurify.removed.pop();
			} catch (e) {}
		}

		/* Execute a hook if present */
		_executeHook('afterSanitizeAttributes', currentNode, null); // No I18N
	};

	/**
	 * _sanitizeShadowDOM
	 *
	 * @param  fragment to iterate over recursively
	 * @return void
	 */
	var _sanitizeShadowDOM = function (fragment) {
		var shadowNode;
		var shadowIterator = _createIterator(fragment);

		/* Execute a hook if present */
		_executeHook('beforeSanitizeShadowDOM', fragment, null); // No I18N

		while ((shadowNode = shadowIterator.nextNode())) {
			/* Execute a hook if present */
			_executeHook('uponSanitizeShadowNode', shadowNode, null); // No I18N

			/* Sanitize tags and elements */
			if (_sanitizeElements(shadowNode)) {
				continue;
			}

			/* Deep shadow DOM detected */
			if (shadowNode.content instanceof DocumentFragment) {
				_sanitizeShadowDOM(shadowNode.content);
			}

			/* Check attributes, sanitize if necessary */
			_sanitizeAttributes(shadowNode);
		}

		/* Execute a hook if present */
		_executeHook('afterSanitizeShadowDOM', fragment, null); // No I18N
	};

	/**
	 * _executeHook
	 * Execute user configurable hooks
	 *
	 * @param  {String} entryPoint  Name of the hook's entry point
	 * @param  {Node} currentNode
	 */
	var _executeHook = function (entryPoint, currentNode, data) {
		if (!hooks[entryPoint]) {
			return;
		}

		hooks[entryPoint].forEach((hook) => {
			hook.call(DOMPurify, currentNode, data, CONFIG);
		});
	};

	/**
	 * sanitize
	 * Public method providing core sanitation functionality
	 *
	 * @param {String|Node} dirty string or DOM node
	 * @param {Object} configuration object
	 */
	DOMPurify.sanitize = function (dirty, cfg) {
		var body, importedNode, currentNode, oldNode, nodeIterator, returnNode;
		/* Make sure we have a string to sanitize.
           DO NOT return early, as this will return the wrong type if
           the user has requested a DOM object rather than a string */
		if (!dirty) {
			dirty = '<!-->'; // No I18N
		}

		/* Stringify, in case dirty is an object */
		if (typeof dirty !== 'string' && !_isNode(dirty)) {
			// No I18N
			if (typeof dirty.toString !== 'function') {
				// No I18N
				throw new TypeError('toString is not a function'); // No I18N
			} else {
				dirty = dirty.toString();
			}
		}

		/* Check we can run. Otherwise fall back or ignore */
		if (!DOMPurify.isSupported) {
			if (
				typeof window.toStaticHTML === 'object' || // No I18N
				typeof window.toStaticHTML === 'function'
			) {
				// No I18N
				if (typeof dirty === 'string') {
					// No I18N
					return window.toStaticHTML(dirty);
				} else if (_isNode(dirty)) {
					return window.toStaticHTML(dirty.outerHTML);
				}
			}
			return dirty;
		}

		/* Assign config vars */
		_parseConfig(cfg);

		/* Clean up removed elements */
		DOMPurify.removed = [];

		if (dirty instanceof Node) {
			/* If dirty is a DOM element, append to an empty document to avoid
               elements being stripped by the parser */
			body = _initDocument('<!-->'); // No I18N
			importedNode = body.ownerDocument.importNode(dirty, true);
			if (importedNode.nodeType === 1 && importedNode.nodeName === 'BODY') {
				// No I18N
				/* Node is already a body, use as is */
				body = importedNode;
			} else {
				body.appendChild(importedNode);
			}
		} else {
			/* Exit directly if we have nothing to do */
			if (!RETURN_DOM && !WHOLE_DOCUMENT && dirty.indexOf('<') === -1) {
				// No I18N
				return dirty;
			}

			/* Initialize the document to work on */
			body = _initDocument(dirty);

			/* Check we have a DOM node from the data */
			if (!body) {
				return RETURN_DOM ? null : ''; // No I18N
			}
		}
		/* Remove first element node (ours) if FORCE_BODY is set */
		if (FORCE_BODY) {
			_forceRemove(body.firstChild);
		}
		/* Get node iterator */
		nodeIterator = _createIterator(body);
		/* Now start iterating over the created document */
		while ((currentNode = nodeIterator.nextNode())) {
			/* Fix IE's strange behavior with manipulated textNodes #89 */
			if (currentNode.nodeType === 3 && currentNode === oldNode) {
				continue;
			}

			/* Sanitize tags and elements */
			if (_sanitizeElements(currentNode)) {
				continue;
			}

			/* Shadow DOM detected, sanitize it */
			if (currentNode.content instanceof DocumentFragment) {
				_sanitizeShadowDOM(currentNode.content);
			}

			/* Check attributes, sanitize if necessary */
			_sanitizeAttributes(currentNode);

			oldNode = currentNode;
		}

		/* Return sanitized string or DOM */
		if (RETURN_DOM) {
			if (RETURN_DOM_FRAGMENT) {
				returnNode = createDocumentFragment.call(body.ownerDocument);

				while (body.firstChild) {
					returnNode.appendChild(body.firstChild);
				}
			} else {
				returnNode = body;
			}

			if (RETURN_DOM_IMPORT) {
				/* adoptNode() is not used because internal state is not reset
                   (e.g. the past names map of a HTMLFormElement), this is safe
                   in theory but we would rather not risk another attack vector.
                   The state that is cloned by importNode() is explicitly defined
                   by the specs. */
				returnNode = importNode.call(originalDocument, returnNode, true);
			}

			return returnNode;
		}

		return WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
	};

	/**
	 * addHook
	 * Public method to add DOMPurify hooks
	 *
	 * @param {String} entryPoint
	 * @param {Function} hookFunction
	 */
	DOMPurify.addHook = function (entryPoint, hookFunction) {
		if (typeof hookFunction !== 'function') {
			// No I18N
			return;
		}
		hooks[entryPoint] = hooks[entryPoint] || [];
		hooks[entryPoint].push(hookFunction);
	};

	/**
	 * removeHook
	 * Public method to remove a DOMPurify hook at a given entryPoint
	 * (pops it from the stack of hooks if more are present)
	 *
	 * @param {String} entryPoint
	 * @return void
	 */
	DOMPurify.removeHook = function (entryPoint) {
		if (hooks[entryPoint]) {
			hooks[entryPoint].pop();
		}
	};

	/**
	 * removeHooks
	 * Public method to remove all DOMPurify hooks at a given entryPoint
	 *
	 * @param  {String} entryPoint
	 * @return void
	 */
	DOMPurify.removeHooks = function (entryPoint) {
		if (hooks[entryPoint]) {
			hooks[entryPoint] = [];
		}
	};

	/**
	 * removeAllHooks
	 * Public method to remove all DOMPurify hooks
	 *
	 * @return void
	 */
	DOMPurify.removeAllHooks = function () {
		hooks = {};
	};

	return DOMPurify;
});

/**
 * Custom Functions for Sanitizer
 **/

var addToSet = function (set, array) {
	var l = array.length;
	while (l--) {
		set[array[l]] = true;
	}
	return set;
};

var addObjsToSet = function (set, set2) {
	for (var each in set2) {
		set[each] = true;
	}
	return set;
};

var removeFromSet = function (set, key) {
	var set2 = {};
	for (var eachKey in set) {
		if (set.hasOwnProperty(eachKey)) {
			if (eachKey != key) {
				set2[eachKey] = set[eachKey];
			}
		}
	}
	return set2;
};

/**
 * Sanitizer
 **/
(function (factory) {
	//Setting base configuration: Start---------------------------------------------------------
	var loadDefaultConfig = function () {
		var config = {};
		config.ALLOW_ARIA_ATTR = true;
		config.ALLOW_DATA_ATTR = true;
		config.ALLOW_UNKNOWN_PROTOCOLS = false;
		config.SAFE_FOR_JQUERY = false;
		config.SAFE_FOR_TEMPLATES = false;
		config.WHOLE_DOCUMENT = false;
		config.RETURN_DOM = false;
		config.RETURN_DOM_FRAGMENT = false;
		config.RETURN_DOM_IMPORT = false;
		config.FORCE_BODY = false;
		config.SANITIZE_DOM = true;
		config.KEEP_CONTENT = true;
		config.STYLE_VALIDATION = true;
		config.ALLOWED_STYLE = 'NONE'; //Values can be either 'INLINE', 'INTERNAL', 'ALL', 'NONE' // No I18N
		config.ALLOWED_TAGS = [
			'a',
			'abbr',
			'acronym',
			'address',
			'area',
			'article',
			'aside',
			'audio',
			'b', // No I18N
			'bdi',
			'bdo',
			'big',
			'blink',
			'blockquote',
			'body',
			'br',
			'button',
			'canvas', // No I18N
			'caption',
			'center',
			'cite',
			'code',
			'col',
			'colgroup',
			'content',
			'data', // No I18N
			'datalist',
			'dd',
			'decorator',
			'del',
			'details',
			'dfn',
			'dir',
			'div',
			'dl',
			'dt', // No I18N
			'element',
			'em',
			'fieldset',
			'figcaption',
			'figure',
			'font',
			'footer',
			'form', // No I18N
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'head',
			'header',
			'hgroup',
			'hr',
			'html',
			'i', // No I18N
			'img',
			'input',
			'ins',
			'kbd',
			'label',
			'legend',
			'li',
			'main',
			'map',
			'mark', // No I18N
			'marquee',
			'menu',
			'menuitem',
			'meter',
			'nav',
			'nobr',
			'ol',
			'optgroup', // No I18N
			'option',
			'output',
			'p',
			'pre',
			'progress',
			'q',
			'rp',
			'rt',
			'ruby',
			's',
			'samp', // No I18N
			'section',
			'select',
			'shadow',
			'small',
			'source',
			'spacer',
			'span',
			'strike', // No I18N
			'strong',
			'sub',
			'summary',
			'sup',
			'table',
			'tbody',
			'td',
			'template', // No I18N
			'textarea',
			'tfoot',
			'th',
			'thead',
			'time',
			'tr',
			'track',
			'tt',
			'u',
			'ul',
			'var', // No I18N
			'video',
			'wbr',
			'#text' // No I18N
		];
		config.ALLOWED_ATTR = [
			'accept',
			'action',
			'align',
			'alt',
			'autocomplete',
			'background',
			'bgcolor', // No I18N
			'border',
			'cellpadding',
			'cellspacing',
			'checked',
			'cite',
			'class',
			'clear',
			'color', // No I18N
			'cols',
			'colspan',
			'coords',
			'datetime',
			'default',
			'dir',
			'disabled', // No I18N
			'download',
			'enctype',
			'face',
			'for',
			'headers',
			'height',
			'hidden',
			'high',
			'href', // No I18N
			'hreflang',
			'id',
			'ismap',
			'label',
			'lang',
			'list',
			'loop',
			'low',
			'max', // No I18N
			'maxlength',
			'media',
			'method',
			'min',
			'multiple',
			'name',
			'noshade',
			'novalidate', // No I18N
			'nowrap',
			'open',
			'optimum',
			'pattern',
			'placeholder',
			'poster',
			'preload',
			'pubdate', // No I18N
			'radiogroup',
			'readonly',
			'rel',
			'required',
			'rev',
			'reversed',
			'role',
			'rows', // No I18N
			'rowspan',
			'spellcheck',
			'scope',
			'selected',
			'shape',
			'size',
			'span', // No I18N
			'srclang',
			'start',
			'src',
			'step',
			'summary',
			'tabindex',
			'title',
			/*Adding attribute target*/ 'target', // No I18N
			'type',
			'usemap',
			'valign',
			'value',
			'width',
			'xmlns' // No I18N
		];
		config.FORBID_TAGS = []; //Add any forbidden tags here
		config.FORBID_ATTR = []; //Add any forbidden attrs here

		config.ALLOWED_TAGS_OBJ = {}; //Do not change.
		config.ALLOWED_ATTR_OBJ = {}; //Do not change.
		config.FORBID_TAGS_OBJ = {}; //Do not change.
		config.FORBID_ATTR_OBJ = {}; //Do not change.

		config.ADD_URI_SAFE_ATTR = [];
		config.EXTEND_PARENT = true;
		config.APPEND_ATTR = [
			{
				ELEMENT_NAME: 'a', // No I18N
				ATTR_NAME: 'rel', // No I18N
				ATTR_VALUE: 'noopener noreferrer', // No I18N
				CRITERIA: {
					// No I18N
					ATTR_NAME: 'target', // No I18N
					ATTR_VALUE: '_blank' // No I18N
				}
			}
		];
		config.VALIDATE_ATTR = [];
		return config;
	};
	var conf = loadDefaultConfig();
	//Setting base configuration: End-----------------------------------------------------------

	ZSEC.util.defineProperty(
		ZSEC,
		'HTMLPurifier',
		factory(conf, DOMPurify(window)),
		true,
		false,
		false,
		true
	); // No I18N
	delete window.DOMPurify; //We are deleting the base DOMPurify Instance
})(function factory(config, DOM) {
	var defaultForbiddenTags = addToSet({}, ['script', 'iframe']); // No I18N
	var defaultForbiddenAttr = addToSet({}, []);

	var inheritableConfig = addToSet({}, [
		'ALLOWED_TAGS',
		'ALLOWED_ATTR',
		'FORBID_TAGS',
		'FORBID_ATTR'
	]); // No I18N
	var inheritableConfigObj = addToSet({}, [
		'ALLOWED_TAGS_OBJ',
		'ALLOWED_ATTR_OBJ',
		'FORBID_TAGS_OBJ',
		'FORBID_ATTR_OBJ'
	]); // No I18N
	var allowedConfig = addToSet({}, [
		'ALLOW_ARIA_ATTR',
		'ALLOW_DATA_ATTR',
		'ALLOW_UNKNOWN_PROTOCOLS',
		'SAFE_FOR_JQUERY',
		'SAFE_FOR_TEMPLATES',
		'WHOLE_DOCUMENT',
		'RETURN_DOM',
		'RETURN_DOM_FRAGMENT',
		'RETURN_DOM_IMPORT',
		'FORCE_BODY',
		'SANITIZE_DOM',
		'KEEP_CONTENT'
	]); // No I18N
	var allConfigFlags = addToSet({}, [
		'ALLOW_ARIA_ATTR',
		'ALLOW_DATA_ATTR',
		'ALLOW_UNKNOWN_PROTOCOLS',
		'SAFE_FOR_JQUERY',
		'SAFE_FOR_TEMPLATES',
		'WHOLE_DOCUMENT',
		'RETURN_DOM',
		'RETURN_DOM_FRAGMENT',
		'RETURN_DOM_IMPORT',
		'FORCE_BODY',
		'SANITIZE_DOM',
		'KEEP_CONTENT',
		'STYLE_VALIDATION',
		'ALLOWED_STYLE',
		'ALLOWED_TAGS',
		'ALLOWED_ATTR',
		'FORBID_TAGS',
		'FORBID_ATTR',
		'ADD_URI_SAFE_ATTR',
		'EXTEND_PARENT',
		'APPEND_ATTR',
		'VALIDATE_ATTR'
	]); // No I18N

	config.FORBID_TAGS_OBJ = addObjsToSet(config.FORBID_TAGS_OBJ, defaultForbiddenTags);
	config.FORBID_ATTR_OBJ = addObjsToSet(config.FORBID_ATTR_OBJ, defaultForbiddenAttr);

	var emptyBlockFiller = false; //Hack-fix for git preventing empty blocks in code
	var altered;

	for (var eachInheritableConfig in inheritableConfig) {
		config[eachInheritableConfig + '_OBJ'] = addToSet(
			config[eachInheritableConfig + '_OBJ'],
			config[eachInheritableConfig]
		); // No I18N
	}

	// This is to parse the additionalConfigurations that are passed while calling the sanitize function.
	// It returns the configuration that is sent to the sanitizer function.
	var parseConfig = function (cfg) {
		if (typeof cfg !== 'object') {
			// No I18N
			return config;
		}
		var customConfig = {};
		for (var each in config) {
			if (each in cfg) {
				if (each in allowedConfig) {
					if (cfg[each] == true || cfg[each] == false) {
						customConfig[each] = cfg[each];
					} else {
						customConfig[each] = config[each];
					}
				} else {
					throw new Error(
						"The configuration param '" +
							each +
							"' can only be set during initial configuration."
					); // No I18N
				}
			} else {
				customConfig[each] = config[each];
			}
		}

		if (customConfig.SAFE_FOR_TEMPLATES) {
			if (customConfig.ALLOW_DATA_ATTR) {
				throw new Error(
					"'ALLOW_DATA_ATTR' should not be set when 'SAFE_FOR_TEMPLATES' is true"
				); // No I18N
			}
		}

		if (customConfig.RETURN_DOM_FRAGMENT) {
			customConfig.RETURN_DOM = true;
		}
		if (customConfig.KEEP_CONTENT) {
			customConfig.ALLOWED_TAGS_OBJ['#text'] = true; // No I18N
		}

		return customConfig;
	};

	//List of CSS Properties allowed when config["STYLE"] is set as "VALIDATE" // No I18N
	var allowedProperties = addToSet({}, [
		'azimuth',
		'background',
		'background-attachment',
		'background-color',
		'background-image',
		'background-position',
		/*Adding Content property*/ 'content', // No I18N
		'background-repeat',
		'border-collapse',
		'border-color',
		'border-top-color',
		'border-right-color',
		'border-bottom-color', // No I18N
		'border-left-color',
		'bottom',
		'caption-side',
		'clear',
		'color',
		'cue-after',
		'cue-before',
		'direction',
		'display', // No I18N
		'elevation',
		'empty-cells',
		'float',
		'font-size',
		'font-size-adjust',
		'font-stretch',
		'font-style',
		'font-variant', // No I18N
		'font-weight',
		'height',
		'left',
		'letter-spacing',
		'line-height',
		'list-style-image',
		'list-style-position', // No I18N
		'list-style-type',
		'marker-offset',
		'max-height',
		'max-width',
		'min-height',
		'min-width',
		'orphans',
		'outline-color', // No I18N
		'overflow',
		'page-break-after',
		'page-break-before',
		'page-break-inside',
		'pause-after',
		'pause-before',
		'pitch', // No I18N
		'pitch-range',
		'position',
		'richness',
		'right',
		'size',
		'speak',
		'speak-header',
		'speak-numeral',
		'speak-punctuation', // No I18N
		'speech-rate',
		'stress',
		'table-layout',
		'text-indent',
		'text-transform',
		'top',
		'unicode-bidi',
		'vertical-align', // No I18N
		'visibility',
		'volume',
		'white-space',
		'widows',
		'width',
		'word-spacing',
		'border-style',
		'border-top-style', // No I18N
		'border-right-style',
		'border-bottom-style',
		'border-left-style',
		'border-top-width',
		'border-right-width', // No I18N
		'border-bottom-width',
		'border-left-width',
		'border-width',
		'margin',
		'margin-top',
		'margin-right',
		'margin-bottom', // No I18N
		'margin-left',
		'outline-style',
		'outline-width',
		'padding',
		'padding-top',
		'padding-right',
		'padding-bottom', // No I18N
		'padding-left',
		'border',
		'border-top',
		'border-right',
		'border-bottom',
		'border-left',
		'cue',
		'list-style', // No I18N
		'marks',
		'outline',
		'pause',
		'text-decoration',
		'border-spacing',
		'clip',
		'counter-increment',
		'clip',
		'cursor', // No I18N
		'text-shadow',
		'font',
		'font-family',
		'page',
		'play-during',
		'text-align',
		'voice-family' // No I18N
	]);

	//The below function is necessary for properly adding the style validation hook
	function validateStyles(styles) {
		// Validate regular CSS properties
		for (var property in styles) {
			if (typeof styles[property] === 'string') {
				// No I18N
				if (styles[property] && allowedProperties[property]) {
					//Add additional Validations here
					emptyBlockFiller = true;
				} else if (styles[property]) {
					if (property != 'cssText' && !/^\d.*/.test(property)) {
						// No I18N
						styles[property] = ''; // No I18N
						altered = true;
					}
				}
			}
		}
	}

	//The cssRules.type determines whether it is Media Query, KeyFrames Query, Regular CSS Query
	// https://developer.mozilla.org/en-US/docs/Web/API/CSSRule
	//The below function is necessary for properly adding the style validation hook
	function validateCSSRules(cssRules) {
		for (var index = cssRules.length - 1; index >= 0; index--) {
			var rule = cssRules[index];
			if ((rule.type == 1 && rule.selectorText) || (rule.type == 8 && rule.keyText)) {
				if (rule.style) {
					validateStyles(rule.style);
				}
			} else if ((rule.type == 4 || rule.type == 7) && rule.cssRules) {
				validateCSSRules(rule.cssRules);
			}
		}
	}

	//The below function is necessary for properly adding the style validation hook
	function addCSSRules(output, cssRules) {
		for (var index = cssRules.length - 1; index >= 0; index--) {
			if (
				cssRules[index].type == 1 ||
				cssRules[index].type == 4 ||
				cssRules[index].type == 7
			) {
				output.push(cssRules[index].cssText);
			}
		}
	}

	//Clears any existing Hooks
	DOM.removeAllHooks();
	altered = false;
	if (config.ALLOWED_STYLE == 'NONE') {
		// No I18N
		config.FORBID_TAGS_OBJ = addToSet(config.FORBID_TAGS_OBJ, ['style']); // No I18N
		config.FORBID_ATTR_OBJ = addToSet(config.FORBID_ATTR_OBJ, ['style']); // No I18N
	}
	if (config.ALLOWED_STYLE == 'INLINE' || config.ALLOWED_STYLE == 'ALL') {
		// No I18N
		if (config.STYLE_VALIDATION) {
			// Hook to enforce CSS attribute sanitization
			DOM.addHook('afterSanitizeAttributes', (node) => {
				// No I18N
				// Hack fix for baseURI + CSS problems in Chrome
				if (!node.ownerDocument.baseURI) {
					var base = document.createElement('base'); // No I18N
					base.href = document.baseURI;
					node.ownerDocument.head.appendChild(base);
				}
				// Check all style attribute values and validate them
				if (node.hasAttribute('style')) {
					// No I18N
					var output = ''; // No I18N
					altered = false;
					validateStyles(node.style);

					if (altered) {
						output = node.style.cssText;
					} else {
						output = node.getAttribute('style'); // No I18N
					}

					// re-add styles in case any are left
					if (output.length) {
						node.setAttribute('style', output); // No I18N
					} else {
						node.removeAttribute('style'); // No I18N
					}
				}
			});
		}
		if (config.ALLOWED_STYLE == 'INLINE') {
			// No I18N
			config.FORBID_TAGS_OBJ = addToSet(config.FORBID_TAGS_OBJ, ['style']); // No I18N
			config.FORBID_ATTR_OBJ = removeFromSet(config.FORBID_ATTR_OBJ, 'style'); // No I18N
		}
	}
	if (config.ALLOWED_STYLE == 'INTERNAL' || config.ALLOWED_STYLE == 'ALL') {
		// No I18N
		if (config.STYLE_VALIDATION) {
			// Hook to enforce CSS Element sanitization
			DOM.addHook('uponSanitizeElement', (node, data) => {
				// No I18N
				if (data.tagName === 'style') {
					// No I18N
					if (node.sheet != null) {
						var styleSheet = node.sheet.cssRules;
						altered = false;
						validateCSSRules(styleSheet);
						if (altered) {
							var output = [];
							addCSSRules(output, styleSheet);
							node.textContent = output.join('\n'); // No I18N
						}
					}
				}
			});
		}
		if (config.ALLOWED_STYLE == 'INTERNAL') {
			// No I18N
			config.FORBID_ATTR_OBJ = addToSet(config.FORBID_ATTR_OBJ, ['style']); // No I18N
			config.FORBID_TAGS_OBJ = removeFromSet(config.FORBID_TAGS_OBJ, 'style'); // No I18N
		}
	}
	if (config.ALLOWED_STYLE == 'ALL') {
		// No I18N
		config.FORBID_TAGS_OBJ = removeFromSet(config.FORBID_TAGS_OBJ, 'style'); // No I18N
		config.FORBID_ATTR_OBJ = removeFromSet(config.FORBID_ATTR_OBJ, 'style'); // No I18N
	}

	//Hook to set 'APPEND_ATTR' rules // No I18N
	if (config.APPEND_ATTR) {
		DOM.addHook('afterSanitizeAttributes', (node) => {
			// No I18N
			for (var each = 0; each < config.APPEND_ATTR.length; each++) {
				var forAll = config.APPEND_ATTR[each].ELEMENT_NAME == undefined;
				if (!forAll) {
					var elementName = config.APPEND_ATTR[each].ELEMENT_NAME;
				}
				var element = config.APPEND_ATTR[each];
				if (forAll || node.nodeName.toLowerCase() == elementName.toLowerCase()) {
					var attrName = element.ATTR_NAME;
					var attrValue = element.ATTR_VALUE;
					if (element.CRITERIA) {
						var conName = element.CRITERIA.ATTR_NAME;
						if (node.hasAttribute(conName.toLowerCase())) {
							if (element.CRITERIA.ATTR_VALUE) {
								var value = node.getAttribute(conName);
								var conValue = element.CRITERIA.ATTR_VALUE;
								if (value.toLowerCase() == conValue.toLowerCase()) {
									node.setAttribute(attrName, attrValue);
								}
							} else {
								node.setAttribute(attrName, attrValue);
							}
						}
					} else {
						node.setAttribute(attrName, attrValue);
					}
				}
			}
		});
	}

	//Hook to set 'VALIDATE_ATTR' rules // No I18N
	if (config.VALIDATE_ATTR) {
		DOM.addHook('afterSanitizeAttributes', (node) => {
			// No I18N
			for (var each = 0; each < config.VALIDATE_ATTR.length; each++) {
				var forAll = false;
				if (config.VALIDATE_ATTR[each].ELEMENT_NAME == undefined) {
					forAll = true;
				}
				if (!forAll) {
					var nodeName = config.VALIDATE_ATTR[each].ELEMENT_NAME;
				}
				var attrName = config.VALIDATE_ATTR[each].ATTR_NAME;
				var attrValue = config.VALIDATE_ATTR[each].ATTR_VALUE;
				var condition, conditionType;
				if (typeof attrValue == 'string' || typeof attrValue == 'number') {
					// No I18N
					conditionType = 'COMPARISION'; // No I18N
				} else if (typeof attrValue.exec == 'function') {
					// No I18N
					conditionType = 'REGEX'; // No I18N
				} else {
					conditionType = 'LIST'; // No I18N
				}

				if (!config.VALIDATE_ATTR[each].CONDITION) {
					if (conditionType == 'COMPARISION') {
						// No I18N
						condition = 'EQUAL'; // No I18N
					} else {
						condition = 'MATCH'; // No I18N
					}
				} else {
					condition = config.VALIDATE_ATTR[each].CONDITION.toUpperCase();
				}

				if (forAll || nodeName.toLowerCase() == node.nodeName.toLowerCase()) {
					if (node.hasAttribute(attrName)) {
						if (conditionType == 'REGEX') {
							// No I18N
							var regex = new RegExp(attrValue);
							if (condition == 'MATCH') {
								// No I18N
								if (!regex.test(node.getAttribute(attrName).toLowerCase())) {
									node.removeAttribute(attrName);
								}
							} else if (condition == 'DONT_MATCH') {
								// No I18N
								if (regex.test(node.getAttribute(attrName).toLowerCase())) {
									node.removeAttribute(attrName);
								}
							}
						} else if (conditionType == 'LIST') {
							// No I18N
							if (condition == 'MATCH') {
								// No I18N
								if (
									attrValue.indexOf(node.getAttribute(attrName).toLowerCase()) ==
									-1
								) {
									node.removeAttribute(attrName);
								}
							} else if (condition == 'DONT_MATCH') {
								// No I18N
								if (
									attrValue.indexOf(node.getAttribute(attrName).toLowerCase()) !=
									-1
								) {
									node.removeAttribute(attrName);
								}
							}
						} else if (conditionType == 'COMPARISION') {
							// No I18N
							if (condition == 'EQUAL') {
								// No I18N
								if (!(node.getAttribute(attrName) == attrValue)) {
									node.removeAttribute(attrName);
								}
							} else if (condition == 'NOT_EQUAL') {
								// No I18N
								if (!(node.getAttribute(attrName) != attrValue)) {
									node.removeAttribute(attrName);
								}
							} else {
								var nodeAttrValue = parseInt(node.getAttribute(attrName));
								if (!isNaN(nodeAttrValue)) {
									if (condition == 'LESSER_THAN') {
										// No I18N
										if (!(nodeAttrValue < attrValue)) {
											node.removeAttribute(attrName);
										}
									} else if (condition == 'LESSER_THAN_OR_EQUAL') {
										// No I18N
										if (!(nodeAttrValue <= attrValue)) {
											node.removeAttribute(attrName);
										}
									} else if (condition == 'GREATER_THAN') {
										// No I18N
										if (!(nodeAttrValue > attrValue)) {
											node.removeAttribute(attrName);
										}
									} else if (condition == 'GREATER_THAN_OR_EQUAL') {
										// No I18N
										if (!(nodeAttrValue >= attrValue)) {
											node.removeAttribute(attrName);
										}
									}
								}
							}
						}
					}
				}
			}
		});
	}

	//Validate the Configuration given by the user when creating a new sanitizer instance. This attaches any missing, but required, flags/params.

	var validateUserConfig = function (conf) {
		var booleanFlags = addToSet({}, [
			'ALLOW_ARIA_ATTR',
			'ALLOW_DATA_ATTR',
			'ALLOW_UNKNOWN_PROTOCOLS',
			'SAFE_FOR_JQUERY',
			'SAFE_FOR_TEMPLATES',
			'WHOLE_DOCUMENT',
			'RETURN_DOM',
			'RETURN_DOM_FRAGMENT',
			'RETURN_DOM_IMPORT',
			'FORCE_BODY',
			'SANITIZE_DOM',
			'KEEP_CONTENT',
			'STYLE_VALIDATION',
			'EXTEND_PARENT'
		]); // No I18N
		if (typeof conf == 'object') {
			// No I18N
			//Check for any misspelled flags
			for (var eachFlag in conf) {
				if (!(eachFlag in allConfigFlags)) {
					throw new Error(
						'Invalid Flag in configuration! Value: ' +
							eachFlag +
							'. Must be one of the following: ' +
							JSON.stringify([
								'ALLOW_ARIA_ATTR',
								'ALLOW_DATA_ATTR',
								'ALLOW_UNKNOWN_PROTOCOLS',
								'SAFE_FOR_JQUERY',
								'SAFE_FOR_TEMPLATES',
								'WHOLE_DOCUMENT',
								'RETURN_DOM',
								'RETURN_DOM_FRAGMENT',
								'RETURN_DOM_IMPORT',
								'FORCE_BODY',
								'SANITIZE_DOM',
								'KEEP_CONTENT',
								'STYLE_VALIDATION',
								'ALLOWED_STYLE',
								'ALLOWED_TAGS',
								'ALLOWED_ATTR',
								'FORBID_TAGS',
								'FORBID_ATTR',
								'ADD_URI_SAFE_ATTR',
								'EXTEND_PARENT',
								'APPEND_ATTR',
								'VALIDATE_ATTR'
							])
					); // No I18N
				}
			}

			//Extending any configurations that may have been missed out
			for (var eachFlag in allConfigFlags) {
				if (
					conf[eachFlag] == undefined &&
					!(eachFlag in inheritableConfig) &&
					eachFlag != 'VALIDATE_ATTR' &&
					eachFlag != 'APPEND_ATTR' &&
					eachFlag != 'ADD_URI_SAFE_ATTR'
				) {
					// No I18N
					conf[eachFlag] = config[eachFlag];
				}
			}

			//Check Values of all Boolean Flags in the configuration
			for (var eachBooleanFlag in booleanFlags) {
				if (!(conf[eachBooleanFlag] === true || conf[eachBooleanFlag] === false)) {
					throw new Error(
						"Invalid Value for '" +
							eachBooleanFlag +
							"' in the configuration. It needs to be either 'true' or 'false'"
					); // No I18N
				}
			}

			//DATA Attributes should be removed when SAFE_FOR_TEMPLATES is set to true
			if (conf.SAFE_FOR_TEMPLATES) {
				if (conf.ALLOW_DATA_ATTR) {
					throw new Error(
						"'ALLOW_DATA_ATTR' should not be set when 'SAFE_FOR_TEMPLATES' is true"
					); // No I18N
				}
			}

			//Validate values of inheritable arrays (ALLOWED_ATTR, ALLOWED_TAGS, FORBID_TAGS, FORBID_ATTR) in configuration
			for (var eachInheritableConfig in inheritableConfig) {
				//Set all inheritable configuration objects(ALLOWED_ATTR_OBJ,ALLOWED_TAGS_OBJ,etc.) in the configuration to an empty Object
				conf[eachInheritableConfig + '_OBJ'] = {}; // No I18N
				if (conf[eachInheritableConfig] != undefined) {
					if (!(conf[eachInheritableConfig].constructor === Array)) {
						throw new Error(
							"Invalid Value for '" +
								eachInheritableConfig +
								"' in the configuration.It must be an Array"
						); // No I18N
					}
				} else {
					//If the inheritable array is not present in configuration
					conf[eachInheritableConfig] = [];
				}
			}

			//Validate value of ALLOWED_STYLE and set allowed tags/attributes accordingly
			if (conf.ALLOWED_STYLE) {
				conf.ALLOWED_STYLE = conf.ALLOWED_STYLE.toUpperCase();

				if (
					!(
						conf.ALLOWED_STYLE == 'ALL' ||
						conf.ALLOWED_STYLE == 'INTERNAL' ||
						conf.ALLOWED_STYLE == 'INLINE' ||
						conf.ALLOWED_STYLE == 'NONE'
					)
				) {
					// No I18N
					throw new Error(
						"Invalid Value for 'ALLOWED_STYLE' in the configuration. It needs to be either 'ALL', 'INTERNAL', 'INLINE' or 'NONE'"
					); // No I18N
				}
			}

			//Validate ADD_URI_SAFE_ATTR in configuration
			if (conf.ADD_URI_SAFE_ATTR) {
				if (!(conf.ADD_URI_SAFE_ATTR.constructor === Array)) {
					throw new Error(
						"Invalid Value for 'ADD_URI_SAFE_ATTR' in the configuration.It must be an Array"
					); // No I18N
				}
			} else {
				conf.ADD_URI_SAFE_ATTR = [];
			}

			//Validate APPEND_ATTR rules in the configuration
			if (conf.APPEND_ATTR) {
				for (var each = 0; each < conf.APPEND_ATTR.length; each++) {
					if (
						conf.APPEND_ATTR[each].ATTR_NAME != undefined &&
						conf.APPEND_ATTR[each].ATTR_VALUE != undefined
					) {
						if (conf.APPEND_ATTR[each].CRITERIA != undefined) {
							if (!(conf.APPEND_ATTR[each].CRITERIA.ATTR_NAME != undefined)) {
								throw new Error(
									'The Attribute Name must be mentioned when specifying a Criteria for APPEND_ATTR rules',
									conf.APPEND_ATTR[each]
								); // No I18N
							}
						}
					} else {
						throw new Error(
							'The Attribute Name and Attribute Value must be mentioned for APPEND_ATTR rules',
							conf.APPEND_ATTR[each]
						); // No I18N
					}
				}
			} else {
				conf.APPEND_ATTR = [];
			}

			//Validate VALIDATE_ATTR rules in the configuration
			if (conf.VALIDATE_ATTR) {
				for (var each = 0; each < conf.VALIDATE_ATTR.length; each++) {
					if (
						!(
							conf.VALIDATE_ATTR[each].ATTR_NAME == undefined ||
							conf.VALIDATE_ATTR[each].ATTR_VALUE == undefined
						)
					) {
						var conditionType = ''; // No I18N
						var condition = ''; // No I18N
						if (
							typeof conf.VALIDATE_ATTR[each].ATTR_VALUE == 'string' ||
							typeof conf.VALIDATE_ATTR[each].ATTR_VALUE == 'number'
						) {
							// No I18N
							conditionType = 'COMPARISION'; // No I18N
						} else if (typeof conf.VALIDATE_ATTR[each].ATTR_VALUE.exec == 'function') {
							// No I18N
							conditionType = 'REGEX'; // No I18N
						} else {
							conditionType = 'LIST'; // No I18N
						}

						if (!conf.VALIDATE_ATTR[each].CONDITION) {
							if (conditionType == 'COMPARISION') {
								// No I18N
								condition = 'EQUAL'; // No I18N
							} else {
								condition = 'MATCH'; // No I18N
							}
						} else {
							condition = conf.VALIDATE_ATTR[each].CONDITION.toUpperCase();
						}
						if (conditionType == 'REGEX') {
							// No I18N
							if (condition != 'MATCH' && condition != 'DONT_MATCH') {
								// No I18N
								throw new Error(
									"Invalid Condition Sub-Type for REGEX condition in the 'VALIDATE_ATTR' rule! It must be either 'MATCH' or 'DONT_MATCH'"
								); // No I18N
							}
						} else if (conditionType == 'LIST') {
							// No I18N
							if (condition != 'MATCH' && condition != 'DONT_MATCH') {
								// No I18N
								throw new Error(
									"Invalid Condition Sub-Type for LIST condition in the 'VALIDATE_ATTR' rule! It must be either 'MATCH' or 'DONT_MATCH'"
								); // No I18N
							}
						} else if (conditionType == 'COMPARISION') {
							// No I18N
							if (condition != 'EQUAL' && condition != 'NOT_EQUAL') {
								// No I18N
								if (
									condition == 'LESSER_THAN' ||
									condition == 'LESSER_THAN_OR_EQUAL' ||
									condition == 'GREATER_THAN' ||
									condition == 'GREATER_THAN_OR_EQUAL'
								) {
									// No I18N
									if (isNaN(parseInt(conf.VALIDATE_ATTR[each].ATTR_VALUE))) {
										throw new Error(
											"Invalid 'ATTR_VALUE' for COMPARISION condition in the 'VALIDATE_ATTR' rule! The 'ATTR_VALUE' must be a number when using the 'LESSER_THAN', 'LESSER_THAN_OR_EQUAL', 'GREATER_THAN' or 'GREATER_THAN_OR_EQUAL' Sub-Type"
										); // No I18N
									}
								} else {
									throw new Error(
										"Invalid Condition Sub-Type for COMPARISION condition in the 'VALIDATE_ATTR' rule! It must be either 'EQUAL', 'NOT_EQUAL', 'LESSER_THAN', 'LESSER_THAN_OR_EQUAL', 'GREATER_THAN' or 'GREATER_THAN_OR_EQUAL'"
									); // No I18N
								}
							}
						} else {
							throw new Error(
								"Invalid Condition Type in the 'VALIDATE_ATTR' rule! It must be either 'REGEX', 'LIST' or 'COMPARISION'"
							); // No I18N
						}
					} else {
						throw new Error(
							'The Attribute Name and Attribute Value must be mentioned for VALIDATE_ATTR rules',
							conf.VALIDATE_ATTR[each]
						); // No I18N
					}
				}
			} else {
				conf.VALIDATE_ATTR = [];
			}

			if (conf.EXTEND_PARENT === true) {
				//Extending Allowed/Forbidden Tags and Attributes Objects from config(parent)
				for (var eachInheritableConfigObj in inheritableConfigObj) {
					if (eachInheritableConfigObj in config) {
						conf[eachInheritableConfigObj] = addObjsToSet(
							conf[eachInheritableConfigObj],
							config[eachInheritableConfigObj]
						);
					}
				}

				//Extending ADD_URI_SAFE_ATTR rules from config(parent)
				if (conf.ADD_URI_SAFE_ATTR) {
					//Check if ADD_URI_SAFE_ATTR exists in conf(child)
					for (var i = 0; i < config.ADD_URI_SAFE_ATTR.length; i++) {
						conf.ADD_URI_SAFE_ATTR.push(config.ADD_URI_SAFE_ATTR[i]);
					}
				}

				//Extending APPEND_ATTR rules from config(parent)
				if (conf.APPEND_ATTR) {
					//Check if APPEND_ATTR exists in conf(child)
					var lengthOfAppendAttrRules = config.APPEND_ATTR.length;
					for (var i = 0; i < lengthOfAppendAttrRules; i++) {
						conf.APPEND_ATTR.push(config.APPEND_ATTR[i]);
					}
				}

				//Extending VALIDATE_ATTR rules from config(parent)
				if (conf.VALIDATE_ATTR) {
					//Check if VALIDATE_ATTR exists in conf(child)
					var lengthOfValidateAttrRules = config.VALIDATE_ATTR.length;
					for (var i = 0; i < lengthOfValidateAttrRules; i++) {
						conf.VALIDATE_ATTR.push(config.VALIDATE_ATTR[i]);
					}
				}
			}

			//Check for mismatch in style validation
			if (conf.ALLOWED_STYLE == 'ALL') {
				// No I18N
				conf.FORBID_TAGS_OBJ = removeFromSet(conf.FORBID_TAGS_OBJ, 'style'); // No I18N
				conf.FORBID_ATTR_OBJ = removeFromSet(conf.FORBID_ATTR_OBJ, 'style'); // No I18N
				conf.ALLOWED_TAGS_OBJ = addToSet(conf.ALLOWED_TAGS_OBJ, ['style']); // No I18N
				conf.ALLOWED_ATTR_OBJ = addToSet(conf.ALLOWED_ATTR_OBJ, ['style']); // No I18N
				if (
					conf.FORBID_TAGS.indexOf('style') > -1 ||
					conf.FORBID_ATTR.indexOf('style') > -1
				) {
					// No I18N
					throw new Error(
						"You have added style to the forbidden tag/attribute list but have specified to not remove it in the 'ALLOWED_STYLE' flag by setting it to 'ALL'"
					); // No I18N
				}
			} else if (conf.ALLOWED_STYLE == 'INLINE') {
				// No I18N
				conf.FORBID_ATTR_OBJ = removeFromSet(conf.FORBID_ATTR_OBJ, 'style'); // No I18N
				conf.ALLOWED_ATTR_OBJ = addToSet(conf.ALLOWED_ATTR_OBJ, ['style']); // No I18N
				conf.FORBID_TAGS_OBJ = addToSet(conf.FORBID_TAGS_OBJ, ['style']); // No I18N
				conf.ALLOWED_TAGS_OBJ = removeFromSet(conf.ALLOWED_TAGS_OBJ, 'style'); // No I18N
				if (conf.FORBID_ATTR.indexOf('style') > -1) {
					// No I18N
					throw new Error(
						"You have added style to the forbidden tag/attribute list but have specified to not remove it in the 'ALLOWED_STYLE' flag by setting it to 'INLINE'"
					); // No I18N
				}
				if (conf.ALLOWED_TAGS.indexOf('style') > -1) {
					// No I18N
					throw new Error(
						"You have added style to the allowed tag list but have specified to remove it in the 'ALLOWED_STYLE' flag by setting it to 'INLINE'"
					); // No I18N
				}
			} else if (conf.ALLOWED_STYLE == 'INTERNAL') {
				// No I18N
				conf.FORBID_TAGS_OBJ = removeFromSet(conf.FORBID_TAGS_OBJ, 'style'); // No I18N
				conf.ALLOWED_TAGS_OBJ = addToSet(conf.ALLOWED_TAGS_OBJ, ['style']); // No I18N
				conf.FORBID_ATTR_OBJ = addToSet(conf.FORBID_ATTR_OBJ, ['style']); // No I18N
				conf.ALLOWED_ATTR_OBJ = removeFromSet(conf.ALLOWED_ATTR_OBJ, 'style'); // No I18N
				if (conf.FORBID_TAGS.indexOf('style') > -1) {
					// No I18N
					throw new Error(
						"You have added style to the forbidden tag/attribute list but have specified to not remove it in the 'ALLOWED_STYLE' flag by setting it to 'INTERNAL'"
					); // No I18N
				}
				if (conf.ALLOWED_ATTR.indexOf('style') > -1) {
					// No I18N
					throw new Error(
						"You have added style to the allowed attribute list but have specified to remove it in the 'ALLOWED_STYLE' flag by setting it to 'INTERNAL'"
					); // No I18N
				}
			} else if (conf.ALLOWED_STYLE == 'NONE') {
				// No I18N
				if (
					conf.ALLOWED_TAGS.indexOf('style') > -1 ||
					conf.ALLOWED_ATTR.indexOf('style') > -1
				) {
					// No I18N
					throw new Error(
						"You have added style to the allowed tag/attribute list but have specified to remove it in the 'ALLOWED_STYLE' flag by setting it to 'NONE'"
					); // No I18N
				}
			}

			//Push all values in inheritable objects to the inheritable arrays
			//Again, once array is complete and up-to-date, copy the values from the inheritable arrays to the inheritable objects
			for (var eachInheritableConfigFlag in inheritableConfig) {
				for (var eachInheritableConfigObjKey in conf[eachInheritableConfigFlag + '_OBJ']) {
					// No I18N
					conf[eachInheritableConfigFlag].push(eachInheritableConfigObjKey);
				}
				conf[eachInheritableConfigFlag + '_OBJ'] = addToSet(
					conf[eachInheritableConfigFlag + '_OBJ'],
					conf[eachInheritableConfigFlag]
				); // No I18N
			}

			//Check for mismatches between allowed/forbidden tags/attributes
			for (var each in conf.ALLOWED_TAGS_OBJ) {
				if (each.toLowerCase() in conf.FORBID_TAGS_OBJ) {
					if (each != 'style') {
						// No I18N
						throw new Error(
							"Conflict in Allowed and Forbidden Tags! Tag '" +
								each +
								"' is given in FORBID_TAGS and ALLOWED_TAGS in configuration!"
						); // No I18N
					}
				}
				if (each.toLowerCase() in defaultForbiddenTags) {
					throw new Error(
						"Tag '" +
							each +
							"' is forbidden by default. The following Tags are forbidden by default: 'script','iframe' "
					); // No I18N
				}
			}
			for (var each in conf.ALLOWED_ATTR_OBJ) {
				if (each.toLowerCase() in conf.FORBID_ATTR_OBJ) {
					if (each != 'style') {
						// No I18N
						throw new Error(
							"Conflict in Allowed and Forbidden Attributes! Attribute '" +
								each +
								"' is given in FORBID_ATTR and ALLOWED_ATTR in configuration!"
						); // No I18N
					}
				}
				if (each.toLowerCase() in defaultForbiddenAttr) {
					throw new Error(
						"Attribute '" +
							each +
							"' is forbidden by default. The following Attributes are forbidden by default: "
					); // No I18N
				}
			}
		}

		//If no user configuration object is supplied, create a configuration with the default values
		else {
			conf = {};
			for (var each in config) {
				conf[each] = config[each].valueOf();
			}
		}
		return conf;
	};

	//Function to create new sanitizer instance based on the configuration
	var HTMLPurifier = function (conf) {
		conf = validateUserConfig(conf);
		return factory(conf, DOM(window));
	};

	//Function to sanitize the dirty content
	HTMLPurifier.sanitize = function (dirty, cfg) {
		var customConfig = parseConfig(cfg);
		return DOM.sanitize(dirty, customConfig);
	};

	if (Object.freeze) {
		HTMLPurifier = Object.freeze(HTMLPurifier);
	}
	return HTMLPurifier;
});
