

$(function () {
    $("#MainArea").on("click", function (event) {
        var sender = $(event.target);

        //alert(sender.attr("id"))
        if (sender.is("#PresetButton") || sender.is("#PresetButton *")) {
            $("#PresetArea").toggle("fast");
        } else if (sender.is("#TranslateButton") && !sender.is(".Disable")) {
            Translate();
        } else if ($("#ClickShowSourceText").prop("checked") && sender.is("#Translation > p") && !$("#ShowSourceText").prop("checked")) {
            var st = sender.find(".SourceText");
            if (st.is(":visible")) {
                $("#Translation .SourceText").hide();
            } else {
                $("#Translation .SourceText").hide();
                st.show();
            }
        }
        //else if (sender.is(".SourceText")) {
        //    sender.hide();
        //}
        else if (sender.is("#ClearButton")) {
            $("#Source").val("").change();
        }
    }).on("change", function (event) {
        var sender = $(event.target);

        if (sender.is("#ClickShowSourceText") && !$("#ShowSourceText").prop("checked")) {
            if (!$("#ClickShowSourceText").prop("checked")) {
                $("#Translation .SourceText").hide();
            }
        } else if (sender.is("#ShowSourceText")) {
            if ($("#ShowSourceText").prop("checked")) {
                $("#Translation .SourceText").show();
            } else {
                $("#Translation .SourceText").hide();
            }
        }
    });

    var hasError = false;

    function Translate() {
        //var test = [];
        //for (var i = 0; i < 20; i++) {
        //    test.push(i);
        //}
        //alert(test);
        //return;

        var preset = GetPreset();

        hasError = false;
        var packages = Preprocessing(preset);
        //alert(packages.toSource())

        if (hasError) {
            return;
        }
        
        console.log("\n自定义词典: \n" + JSON.stringify(preset));
        //console.log(ToSign(12346));
        //return;
        
        AjaxTranslate(packages, function (data) {
            if (data == null) {
                return;
            }

            var result = [];
            $.each(data, function (i, v) {
                $.each(v.trans_result, function (ii, vv) {
                    vv.dst = ToCDB(vv.dst);
                    $.each(preset, function (iii, p) {
                        vv.src = vv.src.replace(p.regSign, p.source);
                        vv.dst = vv.dst.replace(p.regSign, p.dst);
                    });
                    result.push(vv);
                });
            });
            SetTranslation(result);
            $("#ShowSourceText").change();
        });
    }

    // 保存翻译结果
    var TRANS_DATA = null;

    function AjaxTranslate(packages, callback) {
        if ((packages == null) || (packages.length <= 0)) {
            TRANS_DATA = null;
            return;
        }

        var appid = $("#AppId").val();
        var key = $("#Password").val();
        var salt = (new Date).getTime();

        // 多个query可以用\n连接  如 query='apple\norange\nbanana\npear'
        var query = packages[0];
        packages.splice(0, 1);
        if ($.trim(query) == "") {
            DoNextTrans(packages, callback);
            return;
        }

        var from = $("#SourceLan").val();
        var to = $("#TransLan").val();
        var str1 = appid + query + salt + key;
        var sign = MD5(str1);

        //query = encodeURI(query);

        //var formdata = new FormData();
        //formdata.append("q", query);
        //formdata.append("appid", appid);
        //formdata.append("salt", salt);
        //formdata.append("from", from);
        //formdata.append("to", to);
        //formdata.append("sign", sign);

        $("#TranslateButton").addClass("Disable");
        $("#Translation").html('<span style="font-weight:bold;font-size:20px;color:#11a1d1;">正在处理中...</span>')

        $.ajax({
            //url: 'http://api.fanyi.baidu.com/api/trans/vip/translate',
            url: 'https://fanyi-api.baidu.com/api/trans/vip/translate',
            type: 'POST',
            dataType: 'jsonp',
            data: {
                q: query,
                appid: appid,
                salt: salt,
                from: from,
                to: to,
                sign: sign
            },
            //data: formdata,
            //// 不处理数据
            //processData: false,
            //// 不设置内容类型
            //contentType: false,
            success: function (data) {
                if ((data.error_code != null) && ($.trim(data.error_code) != "")) {
                    alert("错误! \n error code: " + data.error_code + "\n" + data.error_msg);
                }

                if (TRANS_DATA == null) {
                    TRANS_DATA = [];
                }
                TRANS_DATA.push(data);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                alert("Ajax错误!\n" + textStatus + "\n" + errorThrown);
            },
            complete: function (jqXHR, textStatus) {
                DoNextTrans(packages, callback);
            }
        });
    }

    function DoNextTrans(packages, callback) {
        if (packages.length > 0) {
            setTimeout(function () { AjaxTranslate(packages, callback); }, 100);
        } else {
            if ((callback != null) && $.isFunction(callback)) {
                callback(TRANS_DATA);
            }

            TRANS_DATA = null;

            $("#TranslateButton").removeClass("Disable");
        }
    }

    function SetTranslation(trans) {
        var transArea = $("#Translation").html("");

        $.each(trans, function (i, data) {
            var src = "";
            if ((data.src != null) && ($.trim(data.src) != "")) {
                src = '<span class="SourceText"><span>' + data.src + '</span><br/></span>';
            }
            transArea.append("<p>" + src + data.dst + "</p>");
        });
    }

    function Preprocessing(preset) {
        var source = $("#Source").val().split("\n");

        var Maximum = 700;

        var transArea = $("#Translation").html("");

        // 处理自定义词典
        for (var i = 0; i < source.length; i++) {
            if (source[i].length > Maximum) {
                hasError = true;
                transArea.append('<div class="ErrorMessage"><span style="font-weight:bold;color:red;">单段语句字数过多, 需要限制在'
                    + Maximum + '个字以内, 请使用换行来进行分割:</span><br/>' + source[i] + '</div>');
            }

            for (var j = 0; j < preset.length; j++) {
                source[i] = source[i].replace(preset[j].regSource, preset[j].sign);
            }
        }

        //// 分包处理, 防止一次翻译请求的字数过长
        var result = [""];
        var pointer = result.length - 1;


        var wordCount = 0;
        for (var i = 0; i < source.length; i++) {
            var newStr = source[i] + "\n";
            wordCount += newStr.length;

            if ((Maximum - wordCount) >= 0) {
                result[pointer] += newStr;
            } else {
                result.push(newStr);
                pointer = result.length - 1;
                wordCount = newStr.length;
            }
        }

        return result;
    }

    function Joint(strList, symbol) {
        ///// 用指定符号将字符串数组拼接为一个字符串
        if(symbol == null){
            symbol = "";
        }
        var result = "";
        for (var i = 0; i < strList.length; i++) {
            result += strList[i];
            if(i < strList.length - 1){
                result += symbol;
            }
        }
        return result;
    }

    function GetPreset() {
        var pList = $("#Preset").val().split("\n");
        var list = [];
        for (var i = pList.length - 1; i >= 0; i--) {
            var v = $.trim(pList[i]);
            if (v != "") {
                var v2 = v.split(":");
                if (v2.length < 2) {
                    continue;
                }
                var p = {
                    source: $.trim(v2[0]),
                    dst: $.trim(v2[1]),
                    // 名词标记
                    //sign: "##" + ToSign(i+1) + "##"
                    sign: "" + ToSign(i) + ""
                };
                if ((p.source == "") || (p.dst == "")) {
                    continue;
                }

                p.regSource = new RegExp(p.source, "gi");
                p.regSign = new RegExp(Joint(p.sign, "\\s{0,}"), "gi");
                //p.regSinString = Joint(p.sign, "\\s{0,}");

                list.push(p);
                //alert(p.dst)
            }
        }

        return list;
    }
    
    // var tttt = "# #！< # #";
    // var regString = Joint("##!<##", "\\s{0,}");
    // var reg = new RegExp(regString, "gi");
    // var tetet = tttt.replace(reg, "");
    // console.log(tetet);
    // console.log(reg.value);

    //匹配这些中文标点符号 。 ？ ！ ， 、 ； ： “ ” ‘ ’ （ ） 《 》 〈 〉 【 】 『 』 「 」 ? ? 〔 〕 … — ～ ? ￥
    //var reg = /[\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5]/;
    

    function ToSign(number) {
        number = number.toString();
        if (number.length > 1) {
            var result = "";
            for(var i =0; i < number.length; i++){
                result += ToSign(number[i]);
            }
            return result;
        }

        // var digitalCode = {
        //     _0: "#",
        //     _1: ";",
        //     _2: "@",
        //     _3: "<",
        //     _4: ">",
        //     _5: "!",
        //     _6: "`",
        //     _7: "~",
        //     _8: "=",
        //     _9: "_"
        // };
        
        var digitalCode = {
            _0: "90712",
            _1: "91733",
            _2: "92742",
            _3: "93763",
            _4: "94711",
            _5: "95798",
            _6: "96707",
            _7: "97700",
            _8: "98766",
            _9: "99778"
        };

        return digitalCode["_" + number];
    }

    //for (var nn = 0; nn < 10; nn++) {
    //    var xx = "##" + ToSign(nn) + "##";
    //    new RegExp(xx, "gi");
    //    console.log(xx);
    //}

    /**
        * 文本框根据输入内容自适应高度
        * @param                {HTMLElement}           输入框元素
        * @param                {Number}                设置光标与输入框保持的距离(默认0)
        * @param                {Number}                设置最大高度(可选)
        */
    var autoTextarea = function (elem, extra, maxHeight) {
        extra = extra || 0;
        var isFirefox = !!document.getBoxObjectFor || 'mozInnerScreenX' in window,
        isOpera = !!window.opera && !!window.opera.toString().indexOf('Opera'),
                addEvent = function (type, callback) {
                    elem.addEventListener ?
                            elem.addEventListener(type, callback, false) :
                            elem.attachEvent('on' + type, callback);
                },
                getStyle = elem.currentStyle ? function (name) {
                    var val = elem.currentStyle[name];

                    if (name === 'height' && val.search(/px/i) !== 1) {
                        var rect = elem.getBoundingClientRect();
                        return rect.bottom - rect.top -
                                parseFloat(getStyle('paddingTop')) -
                                parseFloat(getStyle('paddingBottom')) + 'px';
                    };

                    return val;
                } : function (name) {
                    return getComputedStyle(elem, null)[name];
                },
                minHeight = parseFloat(getStyle('height'));

        elem.style.resize = 'none';

        var change = function () {
            var scrollTop, height,
                    padding = 0,
                    style = elem.style;

            if (elem._length === elem.value.length) return;
            elem._length = elem.value.length;

            if (!isFirefox && !isOpera) {
                padding = parseInt(getStyle('paddingTop')) + parseInt(getStyle('paddingBottom'));
            };
            scrollTop = document.body.scrollTop || document.documentElement.scrollTop;

            elem.style.height = minHeight + 'px';
            if (elem.scrollHeight > minHeight) {
                if (maxHeight && elem.scrollHeight > maxHeight) {
                    height = maxHeight - padding;
                    style.overflowY = 'auto';
                } else {
                    height = elem.scrollHeight - padding;
                    style.overflowY = 'hidden';
                };
                style.height = height + extra + 'px';
                scrollTop += parseInt(style.height) - elem.currHeight;
                document.body.scrollTop = scrollTop;
                document.documentElement.scrollTop = scrollTop;
                elem.currHeight = parseInt(style.height);
            };
        };

        addEvent('propertychange', change);
        addEvent('input', change);
        addEvent('focus', change);
        $(elem).on("change", function () { change(); });
        change();
    };
    autoTextarea($("#Source").get(0));

    var _show = true;
    function isShow() {
        var anchor = $("#ToolbarAnchor").get(0);
        var box = anchor.getBoundingClientRect(),
            show = ((box.top > 0) || (box.bottom > 0)) && ((box.left > 0) || (box.right > 0)) && ($(window).height() > box.top);
        
        if (_show != show) {
            var toolbar = $("#Toolbar")
            if (show) {
                toolbar.removeClass("ToolbarTop");
                $(anchor).after(toolbar);
            } else {
                toolbar.addClass("ToolbarTop");
                $("#MainArea").append(toolbar);
            }
            _show = show;
        }

        //console.log("%c$('ToolbarAnchor') 元素 " + (show ? "在" : "不在") + "当前窗口中显示, box.top: " + box.top, "color:" + (show ? "green" : "red"));
    }
    (window.onscroll = isShow)();

    /**
     * 全角字符转换为半角字符
     * @see https://www.cnblogs.com/moqiutao/p/6869794.html?utm_source=itdadao&utm_medium=referral
     * @param {string} str 
     */
    function ToCDB(str) { 
        var tmp = ""; 
        for(var i=0;i<str.length;i++){ 
            if (str.charCodeAt(i) == 12288){
                tmp += String.fromCharCode(str.charCodeAt(i)-12256);
                continue;
            }
            if(str.charCodeAt(i) > 65280 && str.charCodeAt(i) < 65375){ 
                tmp += String.fromCharCode(str.charCodeAt(i)-65248); 
            } 
            else{ 
                tmp += String.fromCharCode(str.charCodeAt(i)); 
            } 
        } 
        return tmp 
    } 
});