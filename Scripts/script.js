

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
        var preset = GetPreset();

        hasError = false;
        var packages = Preprocessing(preset);
        //alert(packages.toSource())

        if (hasError) {
            return;
        }
        
        AjaxTranslate(packages, function (data) {
            if (data == null) {
                return;
            }

            var _output = $("#TranslationOutput").html("");
            var result = [];
            $.each(data, function (i, v) {
                $.each(v.trans_result, function (ii, vv) {
                    _output.append("<p>dst: " + vv.dst + "</p>");

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

            console.log("完成!");
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

        $("#TranslateButton").addClass("Disable");
        $("#Translation").html('<span style="font-weight:bold;font-size:20px;color:#11a1d1;">正在处理中...</span>')

        console.log("发送翻译请求");
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
                    console.log("翻译请求发送成功, 但是远程翻译程序返回了错误信息: \n error code: " + data.error_code + "; error message: " + data.error_msg);
                    alert("错误! \n error code: " + data.error_code + "\n" + data.error_msg);
                }

                if (TRANS_DATA == null) {
                    TRANS_DATA = [];
                }
                TRANS_DATA.push(data);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log("Ajax错误, 翻译请求发送失败");
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

        console.log("将拆分为" + result.length + "个部分发送翻译请求");

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
        //console.log("创建自定义词典===========");
        var _output = $("#PresetOutput").html("");
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
                //var regSignString = Joint(p.sign, "\\s{0,}");
                var regSignString = p.sign;
                p.regSign = new RegExp(regSignString, "gi");
                //p.regSinString = Joint(p.sign, "\\s{0,}");

                list.push(p);
                //alert(p.dst)

                //console.log(">> " + i +" { source: " + p.source + ", dst: " + p.dst + ", sign: " + p.sign + ", regSign: /" + regSignString + "/gi }");
                _output.append("<p>自定义词典" + i +" { source: " + p.source + ", dst: " + p.dst + ", sign: " + p.sign + ", regSign: /" + regSignString + "/gi } </p>")
            }
        }
        //console.log("===========自定义词典创建完毕");

        return list;
    }
    
    function ToSign(number) {
        // number = number.toString();
        // if (number.length > 1) {
        //     var result = "";
        //     for(var i =0; i < number.length; i++){
        //         result += ToSign(number[i]);
        //     }
        //     return result;
        // }

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

        //return digitalCode["_" + number];

        var t = 902451;
        return t + (+number) * 2;
    }

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