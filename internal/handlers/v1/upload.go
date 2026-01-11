package v1

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/brian-nunez/bscribe/views/pages"
	"github.com/labstack/echo/v4"
)

var (
	transcriptionCache = &sync.Map{}
)

func UploadHandler(c echo.Context) error {
	fileHeader, err := c.FormFile("file-upload")
	if err != nil {
		return c.String(http.StatusBadRequest, "Bad request: file-upload form field missing.")
	}

	// Generate a unique filename to use as a cache key
	ext := filepath.Ext(fileHeader.Filename)
	randomBytes := make([]byte, 8)
	if _, err := rand.Read(randomBytes); err != nil {
		return c.String(http.StatusInternalServerError, "Internal error: failed to generate unique filename.")
	}
	uniqueFilename := fmt.Sprintf("%x%s", randomBytes, ext)

	src, err := fileHeader.Open()
	if err != nil {
		return c.String(http.StatusInternalServerError, "Internal error: failed to open uploaded file.")
	}
	defer src.Close()

	// Prepare the multipart request for the transcription service
	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)
	part, _ := writer.CreateFormFile("file", fileHeader.Filename)
	io.Copy(part, src)
	writer.WriteField("response-format", "verbose_json")
	writer.Close()

	// Asynchronously call the transcription service
	go func() {
		logError := func(msg string, err error) {
			fmt.Fprintf(os.Stderr, "[Transcription Error] %s: %v\n", msg, err)
		}

		req, err := http.NewRequest("POST", "http://192.168.50.241:8080/inference", &requestBody)
		if err != nil {
			logError("failed to create transcription request", err)
			transcriptionCache.Store(uniqueFilename, pages.TranscriptionResponse{Text: "Error: Could not create request for transcription service."})
			return
		}
		req.Header.Set("Content-Type", writer.FormDataContentType())

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			logError("failed to send file to transcription service", err)
			transcriptionCache.Store(uniqueFilename, pages.TranscriptionResponse{Text: "Error: Transcription service is unreachable."})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			errMsg := fmt.Sprintf("Error: Transcription service returned status %s. %s", resp.Status, string(bodyBytes))
			logError("transcription service error", fmt.Errorf(errMsg))
			transcriptionCache.Store(uniqueFilename, pages.TranscriptionResponse{Text: errMsg})
			return
		}

		var transcriptionData pages.TranscriptionResponse
		if err := json.NewDecoder(resp.Body).Decode(&transcriptionData); err != nil {
			logError("failed to decode transcription response", err)
			transcriptionCache.Store(uniqueFilename, pages.TranscriptionResponse{Text: "Error: Could not understand response from transcription service."})
			return
		}
		transcriptionCache.Store(uniqueFilename, transcriptionData)
	}()

	// Immediately return the progress component, which will start polling
	return pages.TranscriptionProgress(uniqueFilename).Render(c.Request().Context(), c.Response().Writer)
}

func TranscriptionResultHandler(c echo.Context) error {
	filename := c.Param("filename")
	if result, ok := transcriptionCache.Load(filename); ok {
		// Result is ready, render it.
		return pages.TranscriptionResult(filename, result.(pages.TranscriptionResponse)).Render(c.Request().Context(), c.Response().Writer)
	}

	// Result not ready, tell the frontend to keep polling by rendering the progress component again.
	return pages.TranscriptionProgress(filename).Render(c.Request().Context(), c.Response().Writer)
}
