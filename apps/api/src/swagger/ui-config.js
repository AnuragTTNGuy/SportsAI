/**
 * Swagger UI browser config (serialized into swagger-initializer.js via fn.toString()).
 * Keep this file as plain .js so tsx does not inject __name() helpers (breaks in the browser).
 * Use `name: function () {}` — not method shorthand `name() {}` (breaks initializer parse).
 */
export function buildSwaggerUiConfig() {
  return {
    persistAuthorization: true,
    tryItOutEnabled: true,
    docExpansion: "full",
    defaultModelsExpandDepth: -1,
    onComplete: function () {
      document.querySelectorAll("button.try-out").forEach(function (button) {
        button.style.display = "none";
      });
      var root = document.getElementById("swagger-ui");
      if (!root) {
        return;
      }
      var hideTryItOutButtons = function () {
        document.querySelectorAll("button.try-out").forEach(function (button) {
          button.style.display = "none";
        });
      };
      new MutationObserver(hideTryItOutButtons).observe(root, {
        childList: true,
        subtree: true,
      });
    },
    requestInterceptor: function (request) {
      var url = request.url || "";
      if (url.indexOf("/embed/v1/events/") === -1) {
        return request;
      }
      if (url.indexOf("apiKey=") !== -1) {
        return request;
      }
      var headers = request.headers || {};
      var apiKey = headers["X-API-Key"] || headers["x-api-key"];
      if (!apiKey) {
        return request;
      }
      var separator = url.indexOf("?") !== -1 ? "&" : "?";
      request.url = url + separator + "apiKey=" + encodeURIComponent(apiKey);
      return request;
    },
    responseInterceptor: function (response) {
      var url = response.url || "";

      if (url.indexOf("/docs/json") !== -1 || url.indexOf("/docs/yaml") !== -1) {
        return response;
      }

      if (response.status && response.status >= 400) {
        return response;
      }

      function resolveAbsoluteUrl(href) {
        if (!href) {
          return "";
        }
        if (href.indexOf("http://") === 0 || href.indexOf("https://") === 0) {
          return href;
        }
        try {
          return new URL(href, window.location.href).href;
        } catch (_err) {
          return href;
        }
      }

      function isHtmlWidgetRequest(reqUrl) {
        if (reqUrl.indexOf("/embed/v1/events/") === -1) {
          return false;
        }
        if (reqUrl.indexOf("/embed/docs/") !== -1) {
          return false;
        }
        return (
          reqUrl.indexOf("/widgets/") !== -1 || reqUrl.indexOf("/board") !== -1
        );
      }

      function isSnippetJsonRequest(reqUrl) {
        return reqUrl.indexOf("/v1/embed/events/") !== -1 && reqUrl.indexOf("iframe-snippet") !== -1;
      }

      function mountPreviews(items) {
        if (!items || !items.length) {
          return;
        }

        function render() {
          var openBlocks = document.querySelectorAll(".opblock.is-open");
          var opblock = openBlocks[openBlocks.length - 1];
          if (!opblock) {
            return false;
          }

          var responsesWrapper = opblock.querySelector(".responses-wrapper");
          if (!responsesWrapper) {
            return false;
          }

          var host = responsesWrapper.parentElement;
          if (!host) {
            return false;
          }

          var existing = host.querySelector(":scope > .sip-widget-preview");
          if (existing) {
            existing.remove();
          }

          var box = document.createElement("div");
          box.className = "sip-widget-preview";

          var heading = document.createElement("p");
          heading.className = "sip-widget-preview-heading";
          heading.textContent = "Embedded widget preview";
          box.appendChild(heading);

          var grid = document.createElement("div");
          grid.className = "sip-widget-preview-grid";

          items.forEach(function (item) {
            var previewUrl = resolveAbsoluteUrl(item.url);
            if (!previewUrl) {
              return;
            }

            var card = document.createElement("div");
            card.className = "sip-widget-preview-item";

            var title = document.createElement("p");
            title.className = "sip-widget-preview-title";
            title.textContent = item.title || "Widget";
            card.appendChild(title);

            var iframe = document.createElement("iframe");
            iframe.title = item.title || "Widget preview";
            iframe.loading = "lazy";
            iframe.src = previewUrl;
            if (item.height) {
              iframe.style.minHeight = String(item.height) + "px";
            }
            card.appendChild(iframe);

            grid.appendChild(card);
          });

          if (!grid.childElementCount) {
            return true;
          }

          box.appendChild(grid);
          host.insertBefore(box, responsesWrapper.nextSibling);
          return true;
        }

        setTimeout(function tryMount(attempt) {
          if (render() || attempt > 12) {
            return;
          }
          setTimeout(function () {
            tryMount(attempt + 1);
          }, 120);
        }, 80);
      }

      function previewsFromSnippetJson(bodyText) {
        var data;
        try {
          data = JSON.parse(bodyText);
        } catch (_err) {
          return [];
        }

        if (data.embedUrl) {
          return [
            {
              title: data.title || data.cardType || "Widget",
              url: data.embedUrl,
              height: data.recommendedHeight,
            },
          ];
        }

        if (data.board && data.board.embedUrl) {
          var items = [
            {
              title: "Full board — " + (data.matchTitle || "all cards"),
              url: data.board.embedUrl,
              height: data.board.recommendedHeight,
            },
          ];
          if (Array.isArray(data.snippets)) {
            data.snippets.forEach(function (snippet) {
              if (!snippet.embedUrl) {
                return;
              }
              items.push({
                title: snippet.title || snippet.cardType || "Card",
                url: snippet.embedUrl,
                height: snippet.recommendedHeight,
              });
            });
          }
          return items;
        }

        return [];
      }

      if (isHtmlWidgetRequest(url)) {
        mountPreviews([
          {
            title: "Live iframe (this request URL)",
            url: url,
          },
        ]);
      } else if (isSnippetJsonRequest(url)) {
        var bodyText = response.text || response.data;
        if (typeof bodyText === "string") {
          mountPreviews(previewsFromSnippetJson(bodyText));
        } else if (response.obj && typeof response.obj === "object") {
          mountPreviews(previewsFromSnippetJson(JSON.stringify(response.obj)));
        }
      }

      return response;
    },
  };
}
