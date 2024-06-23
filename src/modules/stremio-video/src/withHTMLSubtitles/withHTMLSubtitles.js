var EventEmitter = require("eventemitter3");
var cloneDeep = require("lodash.clonedeep");
var deepFreeze = require("deep-freeze");
var Color = require("color");
var ERROR = require("../error");
var subtitlesParser = require("./subtitlesParser");
var subtitlesRenderer = require("./subtitlesRenderer");
var subtitlesConverter = require("./subtitlesConverter");

function withHTMLSubtitles(Video) {
  function VideoWithHTMLSubtitles(options) {
    options = options || {};

    var video = new Video(options);
    video.on("error", onVideoError);
    video.on("propValue", onVideoPropEvent.bind(null, "propValue"));
    video.on("propChanged", onVideoPropEvent.bind(null, "propChanged"));
    Video.manifest.events
      .filter(function (eventName) {
        return !["error", "propValue", "propChanged"].includes(eventName);
      })
      .forEach(function (eventName) {
        video.on(eventName, onOtherVideoEvent(eventName));
      });

    var containerElement = options.containerElement;
    if (!(containerElement instanceof HTMLElement)) {
      throw new Error(
        "Container element required to be instance of HTMLElement"
      );
    }

    var subtitlesElement = document.createElement("div");
    subtitlesElement.style.position = "absolute";
    subtitlesElement.style.right = "0";
    subtitlesElement.style.bottom = "0";
    subtitlesElement.style.left = "0";
    subtitlesElement.style.zIndex = "1";
    subtitlesElement.style.textAlign = "center";
    containerElement.style.position = "relative";
    containerElement.style.zIndex = "0";
    containerElement.appendChild(subtitlesElement);

    var videoState = {
      time: null,
    };
    var cuesByTime = null;
    var secondCuesByTime = null;
    var events = new EventEmitter();
    var destroyed = false;
    var tracks = [];
    var selectedTrackId = null;
    var selectedSecondTrackId = null;
    var delay = null;
    var size = 100;
    var offset = 0;
    var textColor = "rgb(255, 255, 255)";
    var backgroundColor = "rgba(0, 0, 0, 0)";
    var outlineColor = "rgb(34, 34, 34)";
    var opacity = 1;
    var observedProps = {
      extraSubtitlesTracks: false,
      selectedExtraSubtitlesTrackId: false,
      selectedSecondSubtitlesTrackId: false,
      extraSubtitlesDelay: false,
      extraSubtitlesSize: false,
      extraSubtitlesOffset: false,
      extraSubtitlesTextColor: false,
      extraSubtitlesBackgroundColor: false,
      extraSubtitlesOutlineColor: false,
      extraSubtitlesOpacity: false,
    };

    function renderSubtitles() {
      while (
        subtitlesElement.querySelectorAll(".dual-subtitles-1").length > 0
      ) {
        subtitlesElement
          .querySelectorAll(".dual-subtitles-1")
          .forEach((child) => {
            subtitlesElement.removeChild(child);
          });
      }

      if (
        cuesByTime === null ||
        videoState.time === null ||
        !isFinite(videoState.time)
      ) {
        return;
      }

      subtitlesElement.style.bottom = offset + "%";
      subtitlesElement.style.opacity = opacity;
      subtitlesRenderer
        .render(cuesByTime, videoState.time - delay)
        .forEach(function (cueNode) {
          cueNode.className = "dual-subtitles-1";
          cueNode.style.display = "inline-block";
          cueNode.style.padding = "0.2em";
          cueNode.style.whiteSpace = "pre-wrap";
          cueNode.style.fontSize = Math.floor(size / 25) + "vmin";
          cueNode.style.color = textColor;
          cueNode.style.backgroundColor = backgroundColor;
          cueNode.style.textShadow = "1px 1px 0.1em " + outlineColor;
          const br = document.createElement("br");
          br.className = "dual-subtitles-1";

          subtitlesElement.appendChild(cueNode, subtitlesElement.firstChild);
          subtitlesElement.appendChild(br);
        });
    }
    /**
     * Renders the second set of subtitles on the video player.
     *
     * This function removes any existing second subtitles, and then renders new ones based on the current video time.
     * It uses the `subtitlesRenderer` to generate the subtitle nodes, and then appends them to the `subtitlesElement`.
     *
     * @param {HTMLElement} subtitlesElement - The element that will contain the second subtitles.
     * @param {Object} videoState - The current state of the video player, including the current time.
     * @param {Object} secondCuesByTime - The subtitles data, organized by time.
     * @param {number} delay - The delay in seconds between the video time and the subtitle display time.
     * @param {number} offset - The vertical offset of the subtitles from the bottom of the video player, as a percentage.
     * @param {number} opacity - The opacity of the subtitles, between 0 and 1.
     * @param {number} size - The font size of the subtitles, in pixels.
     * @param {string} textColor - The color of the subtitle text.
     * @param {string} backgroundColor - The background color of the subtitles.
     * @param {string} outlineColor - The color of the text shadow outline.
     *
     * @example
     * const subtitlesElement = document.getElementById('subtitles');
     * const videoState = { time: 10.5 };
     * const secondCuesByTime = { 10: ['Subtitle 1', 'Subtitle 2'] };
     * const delay = 0.5;
     * const offset = 10;
     * const opacity = 0.8;
     * const size = 24;
     * const textColor = 'white';
     * const backgroundColor = 'black';
     * const outlineColor = 'gray';
     *
     * renderSecondSubtitles(subtitlesElement, videoState, secondCuesByTime, delay, offset, opacity, size, textColor, backgroundColor, outlineColor);
     */
    function renderSecondSubtitles() {
      while (
        subtitlesElement.querySelectorAll(".dual-subtitles-2").length > 0
      ) {
        subtitlesElement
          .querySelectorAll(".dual-subtitles-2")
          .forEach((child) => {
            subtitlesElement.removeChild(child);
          });
      }

      if (
        secondCuesByTime === null ||
        videoState.time === null ||
        !isFinite(videoState.time)
      ) {
        return;
      }

      subtitlesElement.style.bottom = offset + "%";
      subtitlesElement.style.opacity = opacity;
      subtitlesRenderer
        .render(secondCuesByTime, videoState.time - delay)
        .forEach(function (cueNode) {
          cueNode.className = "dual-subtitles-2";
          cueNode.style.display = "inline-block";
          cueNode.style.padding = "0.2em";
          cueNode.style.whiteSpace = "pre-wrap";
          cueNode.style.fontSize = Math.floor(size / 25) + "vmin";
          cueNode.style.color = textColor;
          cueNode.style.backgroundColor = backgroundColor;
          cueNode.style.textShadow = "1px 1px 0.1em " + outlineColor;
          const br = document.createElement("br");
          br.className = "dual-subtitles-2";

          subtitlesElement.appendChild(br);
          subtitlesElement.insertBefore(cueNode, br);
        });
    }
    function onVideoError(error) {
      events.emit("error", error);
      if (error.critical) {
        command("unload");
      }
    }
    function onVideoPropEvent(eventName, propName, propValue) {
      switch (propName) {
        case "time": {
          videoState.time = propValue;
          Promise.all([renderSubtitles(), renderSecondSubtitles()]);
          break;
        }
      }

      events.emit(eventName, propName, getProp(propName, propValue));
    }
    function onOtherVideoEvent(eventName) {
      return function () {
        events.emit.apply(events, [eventName].concat(Array.from(arguments)));
      };
    }
    function onPropChanged(propName) {
      if (observedProps[propName]) {
        events.emit("propChanged", propName, getProp(propName, null));
      }
    }
    function onError(error) {
      events.emit("error", error);
      if (error.critical) {
        command("unload");
        video.dispatch({ type: "command", commandName: "unload" });
      }
    }
    function getProp(propName, videoPropValue) {
      switch (propName) {
        case "extraSubtitlesTracks": {
          if (destroyed) {
            return [];
          }

          return tracks.slice();
        }
        case "selectedExtraSubtitlesTrackId": {
          if (destroyed) {
            return null;
          }

          return selectedTrackId;
        }
        case "selectedSecondSubtitlesTrackId": {
          if (destroyed) {
            return null;
          }

          return selectedSecondTrackId;
        }
        case "extraSubtitlesDelay": {
          if (destroyed) {
            return null;
          }

          return delay;
        }
        case "extraSubtitlesSize": {
          if (destroyed) {
            return null;
          }

          return size;
        }
        case "extraSubtitlesOffset": {
          if (destroyed) {
            return null;
          }

          return offset;
        }
        case "extraSubtitlesTextColor": {
          if (destroyed) {
            return null;
          }

          return textColor;
        }
        case "extraSubtitlesBackgroundColor": {
          if (destroyed) {
            return null;
          }

          return backgroundColor;
        }
        case "extraSubtitlesOutlineColor": {
          if (destroyed) {
            return null;
          }

          return outlineColor;
        }
        case "extraSubtitlesOpacity": {
          if (destroyed) {
            return null;
          }

          return opacity;
        }
        default: {
          return videoPropValue;
        }
      }
    }
    function observeProp(propName) {
      switch (propName) {
        case "extraSubtitlesTracks":
        case "selectedExtraSubtitlesTrackId":
        case "selectedSecondSubtitlesTrackId":
        case "extraSubtitlesDelay":
        case "extraSubtitlesSize":
        case "extraSubtitlesOffset":
        case "extraSubtitlesTextColor":
        case "extraSubtitlesBackgroundColor":
        case "extraSubtitlesOutlineColor":
        case "extraSubtitlesOpacity": {
          events.emit("propValue", propName, getProp(propName, null));
          observedProps[propName] = true;
          return true;
        }
        default: {
          return false;
        }
      }
    }
    function setProp(propName, propValue) {
      switch (propName) {
        case "selectedExtraSubtitlesTrackId": {
          cuesByTime = null;
          selectedTrackId = null;
          delay = null;
          var selectedTrack = tracks.find(function (track) {
            return track.id === propValue;
          });
          if (selectedTrack) {
            selectedTrackId = selectedTrack.id;
            delay = 0;
            fetch(selectedTrack.url)
              .then(function (resp) {
                if (resp.ok) {
                  return resp.text();
                }

                throw new Error(resp.status + " (" + resp.statusText + ")");
              })
              .then(function (text) {
                return subtitlesConverter.convert(text);
              })
              .then(function (text) {
                return subtitlesParser.parse(text);
              })
              .then(function (result) {
                if (selectedTrackId !== selectedTrack.id) {
                  return;
                }

                cuesByTime = result;
                renderSubtitles();
                events.emit("extraSubtitlesTrackLoaded", selectedTrack);
              })
              .catch(function (error) {
                if (selectedTrackId !== selectedTrack.id) {
                  return;
                }

                onError(
                  Object.assign({}, ERROR.WITH_HTML_SUBTITLES.LOAD_FAILED, {
                    error: error,
                    track: selectedTrack,
                    critical: false,
                  })
                );
              });
          }
          renderSubtitles();
          onPropChanged("selectedExtraSubtitlesTrackId");
          onPropChanged("extraSubtitlesDelay");
          return true;
        }
        case "selectedSecondSubtitlesTrackId": {
          secondCuesByTime = null;
          selectedSecondTrackId = null;
          // delay = null;
          var selectedSecondTrack = tracks.find(function (track) {
            return track.id === propValue;
          });
          if (selectedSecondTrack) {
            selectedSecondTrackId = selectedSecondTrack.id;
            // delay = 0;
            fetch(selectedSecondTrack.url)
              .then(function (resp) {
                if (resp.ok) {
                  return resp.text();
                }

                throw new Error(resp.status + " (" + resp.statusText + ")");
              })
              .then(function (text) {
                return subtitlesConverter.convert(text);
              })
              .then(function (text) {
                return subtitlesParser.parse(text);
              })
              .then(function (result) {
                if (selectedSecondTrackId !== selectedSecondTrack.id) {
                  return;
                }

                secondCuesByTime = result;
                renderSecondSubtitles();
                events.emit("secondSubtitlesTrackLoaded", selectedSecondTrack);
              })
              .catch(function (error) {
                if (selectedSecondTrackId !== selectedSecondTrack.id) {
                  return;
                }

                onError(
                  Object.assign({}, ERROR.WITH_HTML_SUBTITLES.LOAD_FAILED, {
                    error: error,
                    track: selectedSecondTrack,
                    critical: false,
                  })
                );
              });
          }
          renderSecondSubtitles();
          onPropChanged("selectedSecondSubtitlesTrackId");
          // onPropChanged('extraSubtitlesDelay');
          return true;
        }
        case "extraSubtitlesDelay": {
          if (
            selectedTrackId !== null &&
            propValue !== null &&
            isFinite(propValue)
          ) {
            delay = parseInt(propValue, 10);
            renderSubtitles();
            renderSecondSubtitles();
            onPropChanged("extraSubtitlesDelay");
          }

          return true;
        }
        case "extraSubtitlesSize": {
          if (propValue !== null && isFinite(propValue)) {
            size = Math.max(0, parseInt(propValue, 10));
            renderSubtitles();
            renderSecondSubtitles();
            onPropChanged("extraSubtitlesSize");
          }

          return true;
        }
        case "extraSubtitlesOffset": {
          if (propValue !== null && isFinite(propValue)) {
            offset = Math.max(0, Math.min(100, parseInt(propValue, 10)));
            renderSubtitles();
            renderSecondSubtitles();
            onPropChanged("extraSubtitlesOffset");
          }

          return true;
        }
        case "extraSubtitlesTextColor": {
          if (typeof propValue === "string") {
            try {
              textColor = Color(propValue).rgb().string();
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error("withHTMLSubtitles", error);
            }

            renderSubtitles();
            renderSecondSubtitles();
            onPropChanged("extraSubtitlesTextColor");
          }

          return true;
        }
        case "extraSubtitlesBackgroundColor": {
          if (typeof propValue === "string") {
            try {
              backgroundColor = Color(propValue).rgb().string();
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error("withHTMLSubtitles", error);
            }

            renderSubtitles();
            renderSecondSubtitles();
            onPropChanged("extraSubtitlesBackgroundColor");
          }

          return true;
        }
        case "extraSubtitlesOutlineColor": {
          if (typeof propValue === "string") {
            try {
              outlineColor = Color(propValue).rgb().string();
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error("withHTMLSubtitles", error);
            }

            renderSubtitles();
            renderSecondSubtitles();
            onPropChanged("extraSubtitlesOutlineColor");
          }

          return true;
        }
        case "extraSubtitlesOpacity": {
          if (typeof propValue === "number") {
            try {
              opacity = Math.min(Math.max(propValue / 100, 0), 1);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error("withHTMLSubtitles", error);
            }

            renderSubtitles();
            renderSecondSubtitles();
            onPropChanged("extraSubtitlesOpacity");
          }

          return true;
        }
        default: {
          return false;
        }
      }
    }
    function command(commandName, commandArgs) {
      switch (commandName) {
        case "addExtraSubtitlesTracks": {
          if (commandArgs && Array.isArray(commandArgs.tracks)) {
            tracks = tracks
              .concat(commandArgs.tracks)
              .filter(function (track, index, tracks) {
                return (
                  track &&
                  typeof track.id === "string" &&
                  typeof track.url === "string" &&
                  typeof track.lang === "string" &&
                  typeof track.label === "string" &&
                  typeof track.origin === "string" &&
                  !track.embedded &&
                  index ===
                    tracks.findIndex(function (t) {
                      return t.id === track.id;
                    })
                );
              });
            onPropChanged("extraSubtitlesTracks");
          }

          return true;
        }
        case "load": {
          command("unload");
          if (
            commandArgs.stream &&
            Array.isArray(commandArgs.stream.subtitles)
          ) {
            command("addExtraSubtitlesTracks", {
              tracks: commandArgs.stream.subtitles.map(function (track) {
                return Object.assign({}, track, {
                  origin: "EXCLUSIVE",
                  exclusive: true,
                  embedded: false,
                });
              }),
            });
          }

          return false;
        }
        case "unload": {
          cuesByTime = null;
          secondCuesByTime = null;
          tracks = [];
          selectedTrackId = null;
          selectedSecondTrackId = null;
          delay = null;
          renderSubtitles();
          renderSecondSubtitles();
          onPropChanged("extraSubtitlesTracks");
          onPropChanged("selectedExtraSubtitlesTrackId");
          onPropChanged("selectedSecondSubtitlesTrackId");
          onPropChanged("extraSubtitlesDelay");
          return false;
        }
        case "destroy": {
          command("unload");
          destroyed = true;
          onPropChanged("extraSubtitlesSize");
          onPropChanged("extraSubtitlesOffset");
          onPropChanged("extraSubtitlesTextColor");
          onPropChanged("extraSubtitlesBackgroundColor");
          onPropChanged("extraSubtitlesOutlineColor");
          onPropChanged("extraSubtitlesOpacity");
          video.dispatch({ type: "command", commandName: "destroy" });
          events.removeAllListeners();
          containerElement.removeChild(subtitlesElement);
          return true;
        }
        default: {
          return false;
        }
      }
    }

    this.on = function (eventName, listener) {
      if (destroyed) {
        throw new Error("Video is destroyed");
      }

      events.on(eventName, listener);
    };
    this.dispatch = function (action) {
      if (destroyed) {
        throw new Error("Video is destroyed");
      }

      if (action) {
        action = deepFreeze(cloneDeep(action));
        switch (action.type) {
          case "observeProp": {
            if (observeProp(action.propName)) {
              return;
            }

            break;
          }
          case "setProp": {
            if (setProp(action.propName, action.propValue)) {
              return;
            }

            break;
          }
          case "command": {
            if (command(action.commandName, action.commandArgs)) {
              return;
            }

            break;
          }
        }
      }

      video.dispatch(action);
    };
  }

  VideoWithHTMLSubtitles.canPlayStream = function (stream) {
    return Video.canPlayStream(stream);
  };

  VideoWithHTMLSubtitles.manifest = {
    name: Video.manifest.name + "WithHTMLSubtitles",
    external: Video.manifest.external,
    props: Video.manifest.props
      .concat([
        "extraSubtitlesTracks",
        "selectedExtraSubtitlesTrackId",
        "selectedSecondSubtitlesTrackId",
        "extraSubtitlesDelay",
        "extraSubtitlesSize",
        "extraSubtitlesOffset",
        "extraSubtitlesTextColor",
        "extraSubtitlesBackgroundColor",
        "extraSubtitlesOutlineColor",
        "extraSubtitlesOpacity",
      ])
      .filter(function (value, index, array) {
        return array.indexOf(value) === index;
      }),
    commands: Video.manifest.commands
      .concat(["load", "unload", "destroy", "addExtraSubtitlesTracks"])
      .filter(function (value, index, array) {
        return array.indexOf(value) === index;
      }),
    events: Video.manifest.events
      .concat([
        "propValue",
        "propChanged",
        "error",
        "extraSubtitlesTrackLoaded",
      ])
      .filter(function (value, index, array) {
        return array.indexOf(value) === index;
      }),
  };

  return VideoWithHTMLSubtitles;
}

module.exports = withHTMLSubtitles;
