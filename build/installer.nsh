; NSIS installer custom script for 风灵月影宗
; Referenced by package.json build.nsis.include; keep macros even when empty
; so electron-builder's include preprocessor always resolves.

SetCompressor lzma

!macro customInit
  ; reserved for future installer customization
!macroend

!macro customInstall
  ; reserved for future installer customization
!macroend

; Override electron-builder's default uninstall file removal.
; Default update flow (--updated) atomically Renames every file in $INSTDIR into the new
; installer's $PLUGINSDIR\old-install. Rename cannot cross volumes and cannot move the
; running installer image itself, so any install directory outside the system drive (or a
; payload left inside it) makes in-app updates fail with "Failed to uninstall old
; application files" (v0.4.x incident). Since 0.4.2 installed builds keep user data in
; %APPDATA% (never inside $INSTDIR), so plain in-place removal is safe for both the
; update flow and normal uninstall.
!macro customRemoveFiles
  RMDir /r "$INSTDIR"
!macroend
