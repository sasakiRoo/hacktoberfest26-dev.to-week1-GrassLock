package com.example.grasslock.ui.main

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.LinkOff
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.Spa
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Usb
import androidx.compose.material.icons.outlined.Whatshot
import androidx.compose.material.icons.outlined.Wifi
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

// Taste Skill Soft-Skill Palette (Calm Obsidian, Restrained Meadow Emerald, Soft Contrast)
val BgBase = Color(0xFF0A0D0B)
val BgSurface = Color(0xFF111613)
val BgCard = Color(0xFF151B18)
val BorderSubtle = Color(0x1AFFFFFF)
val BorderAccent = Color(0x3322C55E)
val TextPrimary = Color(0xFFF2F1ED)
val TextSecondary = Color(0xFF9AA59E)
val TextMuted = Color(0xFF616E66)
val AccentEmerald = Color(0xFF22C55E)
val AccentAmber = Color(0xFFF59E0B)
val AccentDanger = Color(0xFFEF4444)

// Time Formatter (MM:SS)
fun formatTime(totalSeconds: Int): String {
  val safe = maxOf(0, totalSeconds)
  val mins = safe / 60
  val secs = safe % 60
  return "%02d:%02d".format(mins, secs)
}

@Composable
fun MainScreen(
  modifier: Modifier = Modifier
) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val scrollState = rememberScrollState()

  // Connection State
  var connectionMode by remember { mutableStateOf("usb") } // "usb" or "wifi"
  var serverIp by remember { mutableStateOf("127.0.0.1") }
  var serverPort by remember { mutableStateOf("3847") }
  var isConnected by remember { mutableStateOf(false) }
  var isConnecting by remember { mutableStateOf(false) }
  var connectionError by remember { mutableStateOf<String?>(null) }

  // Sentinel Desktop State
  var isLocked by remember { mutableStateOf(false) }
  var targetAppCount by remember { mutableStateOf(0) }
  var breakSecondsRemaining by remember { mutableStateOf(300) }
  var isNatureVerified by remember { mutableStateOf(false) }
  var grassStreak by remember { mutableStateOf(1) }

  // Proof of Nature Photo State (LIVE CAMERA ONLY)
  var capturedBitmap by remember { mutableStateOf<Bitmap?>(null) }
  var isVerifying by remember { mutableStateOf(false) }
  var verificationResult by remember { mutableStateOf<String?>(null) }
  var verificationError by remember { mutableStateOf<String?>(null) }

  // 1. Live Camera Capture Launcher
  val cameraLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.TakePicturePreview()
  ) { bitmap ->
    if (bitmap != null) {
      capturedBitmap = bitmap
      connectionError = null
      verificationResult = null
      verificationError = null
    } else {
      Toast.makeText(context, "No photo captured.", Toast.LENGTH_SHORT).show()
    }
  }

  // 2. Camera Runtime Permission Launcher
  val cameraPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { isGranted ->
    if (isGranted) {
      try {
        cameraLauncher.launch(null)
      } catch (e: Exception) {
        Toast.makeText(context, "Failed to launch camera: ${e.message}", Toast.LENGTH_LONG).show()
      }
    } else {
      Toast.makeText(context, "Camera permission is required to capture outdoor nature proof.", Toast.LENGTH_LONG).show()
    }
  }

  // Safe Camera Trigger Function
  val triggerCamera: () -> Unit = {
    val hasPermission = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED

    if (hasPermission) {
      try {
        cameraLauncher.launch(null)
      } catch (e: Exception) {
        Toast.makeText(context, "Failed to open camera: ${e.message}", Toast.LENGTH_LONG).show()
      }
    } else {
      cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
    }
  }

  // Auto-Detect Desktop Sentinel on Local Subnet or Hotspot
  fun autoDetectDesktopIp() {
    isConnecting = true
    connectionError = null
    scope.launch {
      val foundIp = withContext(Dispatchers.IO) {
        val candidates = mutableListOf<String>()
        if (serverIp != "127.0.0.1" && serverIp.isNotBlank()) candidates.add(serverIp)
        candidates.add("10.29.174.71") // User desktop IP
        
        // Scan /proc/net/arp entries (especially in mobile hotspot mode)
        try {
          val arpLines = java.io.File("/proc/net/arp").readLines()
          for (line in arpLines) {
            val parts = line.trim().split(Regex("\\s+"))
            if (parts.size >= 4 && parts[0] != "IP" && parts[2] != "0x0") {
              candidates.add(parts[0])
            }
          }
        } catch (e: Exception) {}

        // Probe candidate IPs on port 3847
        var matched: String? = null
        for (ip in candidates.distinct()) {
          try {
            val url = URL("http://$ip:$serverPort/api/status?source=mobile")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 900
            conn.readTimeout = 900
            conn.requestMethod = "GET"
            if (conn.responseCode == 200) {
              matched = ip
              break
            }
          } catch (e: Exception) {}
        }
        matched
      }
      isConnecting = false
      if (foundIp != null) {
        serverIp = foundIp
        connectionError = null
        Toast.makeText(context, "Desktop discovered at $foundIp:$serverPort", Toast.LENGTH_SHORT).show()
      } else {
        Toast.makeText(context, "Desktop not detected automatically. Please enter IP shown on desktop.", Toast.LENGTH_LONG).show()
      }
    }
  }

  // Explicit Connect Handshake
  fun connectToDesktop() {
    isConnecting = true
    connectionError = null
    scope.launch {
      val (success, errorMsg) = withContext(Dispatchers.IO) {
        try {
          val url = URL("http://$serverIp:$serverPort/api/companion/ping")
          val conn = url.openConnection() as HttpURLConnection
          conn.requestMethod = "POST"
          conn.setRequestProperty("Content-Type", "application/json")
          conn.setRequestProperty("User-Agent", "GrassLock-Android/1.0 (Dalvik Mobile Companion)")
          conn.connectTimeout = 3500
          conn.readTimeout = 3500
          conn.doOutput = true
          val payload = JSONObject().apply {
            put("deviceModel", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("mode", connectionMode)
          }
          conn.outputStream.write(payload.toString().toByteArray())
          val code = conn.responseCode
          if (code == 200) {
            val resp = conn.inputStream.bufferedReader().readText()
            val json = JSONObject(resp)
            val appState = json.optJSONObject("appState")
            if (appState != null) {
              isLocked = appState.optBoolean("isLocked", false)
              val activeApps = appState.optJSONArray("currentActiveApps")
              targetAppCount = activeApps?.length() ?: 0
              breakSecondsRemaining = appState.optInt("breakSecondsRemaining", 0)
              isNatureVerified = appState.optBoolean("isNatureVerified", false)
              grassStreak = appState.optInt("grassStreak", 1)
            }
            Pair(true, null)
          } else {
            Pair(false, "Server returned HTTP status $code.")
          }
        } catch (e: Exception) {
          val hint = if (connectionMode == "usb") {
            "Unable to connect to 127.0.0.1:$serverPort via USB. Verify 'adb reverse tcp:3847 tcp:3847' is configured."
          } else {
            "Unable to connect to $serverIp:$serverPort. Confirm phone and PC share the same Wi-Fi network."
          }
          Pair(false, hint)
        }
      }
      isConnecting = false
      if (success) {
        isConnected = true
        connectionError = null
        Toast.makeText(context, "Connected to GrassLock Desktop Sentinel.", Toast.LENGTH_SHORT).show()
      } else {
        isConnected = false
        connectionError = errorMsg
      }
    }
  }

  // Explicit Disconnect Action
  fun disconnectFromDesktop() {
    val previousIp = serverIp
    val previousPort = serverPort
    isConnected = false
    isConnecting = false
    connectionError = null
    scope.launch {
      withContext(Dispatchers.IO) {
        try {
          val url = URL("http://$previousIp:$previousPort/api/companion/disconnect")
          val conn = url.openConnection() as HttpURLConnection
          conn.requestMethod = "POST"
          conn.connectTimeout = 1500
          conn.readTimeout = 1500
          conn.responseCode
        } catch (e: Exception) {}
      }
    }
    Toast.makeText(context, "Disconnected from Desktop Sentinel.", Toast.LENGTH_SHORT).show()
  }

  // Polling loop: Resilient to camera capture and active uploads
  LaunchedEffect(isConnected, serverIp, serverPort) {
    if (!isConnected) return@LaunchedEffect
    var consecutiveErrors = 0
    while (isConnected) {
      if (!isVerifying) {
        try {
          val result = withContext(Dispatchers.IO) {
            val url = URL("http://$serverIp:$serverPort/api/status?source=mobile")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 3500
            conn.readTimeout = 3500
            conn.setRequestProperty("User-Agent", "GrassLock-Android/1.0 (Dalvik Mobile Companion)")
            conn.requestMethod = "GET"
            if (conn.responseCode == 200) {
              val responseText = conn.inputStream.bufferedReader().readText()
              JSONObject(responseText)
            } else null
          }

          if (result != null) {
            consecutiveErrors = 0
            isLocked = result.optBoolean("isLocked", false)
            val activeApps = result.optJSONArray("currentActiveApps")
            targetAppCount = activeApps?.length() ?: 0
            breakSecondsRemaining = result.optInt("breakSecondsRemaining", 0)
            isNatureVerified = result.optBoolean("isNatureVerified", false)
            grassStreak = result.optInt("grassStreak", grassStreak)
          } else {
            consecutiveErrors++
            if (consecutiveErrors >= 6) {
              isConnected = false
              connectionError = "Connection lost: Desktop Sentinel is not responding."
            }
          }
        } catch (e: Exception) {
          consecutiveErrors++
          if (consecutiveErrors >= 6) {
            isConnected = false
            connectionError = "Connection lost: ${e.message ?: "Unstable connection"}"
          }
        }
      }
      delay(2500)
    }
  }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(BgBase)
      .verticalScroll(scrollState)
      .padding(16.dp),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    // ==========================================
    // 1. HEADER (Soft-Skill Floating Top Bar)
    // ==========================================
    Surface(
      modifier = Modifier
        .fillMaxWidth()
        .padding(bottom = 16.dp),
      color = BgSurface,
      shape = RoundedCornerShape(20.dp),
      border = BorderStroke(1.dp, BorderSubtle)
    ) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 14.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Box(
            modifier = Modifier
              .size(34.dp)
              .clip(CircleShape)
              .background(BgCard)
              .border(1.dp, BorderAccent, CircleShape),
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = Icons.Outlined.Spa,
              contentDescription = "GrassLock Brand",
              tint = AccentEmerald,
              modifier = Modifier.size(18.dp)
            )
          }
          Spacer(Modifier.width(10.dp))
          Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
              Text(
                "GrassLock",
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                letterSpacing = (-0.2).sp
              )
              Spacer(Modifier.width(6.dp))
              Surface(
                color = AccentEmerald.copy(alpha = 0.15f),
                shape = RoundedCornerShape(4.dp)
              ) {
                Text(
                  "GEMMA 4",
                  color = AccentEmerald,
                  fontSize = 8.sp,
                  fontWeight = FontWeight.Bold,
                  modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                )
              }
            }
            Text(
              "Mobile Companion",
              color = TextMuted,
              fontSize = 10.sp,
              fontWeight = FontWeight.Medium
            )
          }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
          // Streak Chip
          Surface(
            color = BgCard,
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, BorderSubtle)
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                imageVector = Icons.Outlined.Whatshot,
                contentDescription = "Streak",
                tint = AccentAmber,
                modifier = Modifier.size(12.dp)
              )
              Spacer(Modifier.width(3.dp))
              Text(
                "$grassStreak",
                color = TextPrimary,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold
              )
            }
          }

          Spacer(Modifier.width(6.dp))

          // Connection State Pill
          Surface(
            color = if (isConnected) AccentEmerald.copy(alpha = 0.12f) else Color(0x18FFFFFF),
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, if (isConnected) AccentEmerald.copy(alpha = 0.4f) else BorderSubtle)
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Box(
                modifier = Modifier
                  .size(5.dp)
                  .clip(CircleShape)
                  .background(if (isConnected) AccentEmerald else TextMuted)
              )
              Spacer(Modifier.width(4.dp))
              Text(
                if (isConnected) "ONLINE" else "STANDBY",
                color = if (isConnected) AccentEmerald else TextMuted,
                fontSize = 8.5.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                maxLines = 1,
                softWrap = false
              )
            }
          }
        }
      }
    }

    // ==========================================
    // 2. COMPANION CONNECTION CARD (Double-Bezel)
    // ==========================================
    Surface(
      modifier = Modifier
        .fillMaxWidth()
        .padding(bottom = 14.dp),
      color = BgSurface,
      shape = RoundedCornerShape(16.dp),
      border = BorderStroke(1.dp, if (isConnected) AccentEmerald.copy(alpha = 0.3f) else BorderSubtle)
    ) {
      Column(Modifier.padding(14.dp)) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            "COMPANION CONNECTION",
            color = TextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace
          )

          if (isConnected) {
            Text(
              "http://$serverIp:$serverPort",
              color = AccentEmerald,
              fontSize = 11.sp,
              fontFamily = FontFamily.Monospace,
              fontWeight = FontWeight.SemiBold
            )
          }
        }

        Spacer(Modifier.height(10.dp))

        if (!isConnected) {
          // Connection Mode Selector
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            Surface(
              modifier = Modifier
                .weight(1f)
                .clickable {
                  connectionMode = "usb"
                  serverIp = "127.0.0.1"
                  connectionError = null
                },
              color = if (connectionMode == "usb") BgCard else Color.Transparent,
              shape = RoundedCornerShape(10.dp),
              border = BorderStroke(1.dp, if (connectionMode == "usb") AccentEmerald.copy(alpha = 0.6f) else BorderSubtle)
            ) {
              Row(
                modifier = Modifier.padding(vertical = 10.dp, horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                Icon(
                  imageVector = Icons.Outlined.Usb,
                  contentDescription = "USB",
                  tint = if (connectionMode == "usb") AccentEmerald else TextSecondary,
                  modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(8.dp))
                Column {
                  Text(
                    "USB Cable (ADB)",
                    color = if (connectionMode == "usb") AccentEmerald else TextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                  )
                  Text("Port 3847 reverse", color = TextMuted, fontSize = 9.sp)
                }
              }
            }

            Surface(
              modifier = Modifier
                .weight(1f)
                .clickable {
                  connectionMode = "wifi"
                  if (serverIp == "127.0.0.1" || serverIp == "192.168.1.") serverIp = "10.29.174.71"
                  connectionError = null
                },
              color = if (connectionMode == "wifi") BgCard else Color.Transparent,
              shape = RoundedCornerShape(10.dp),
              border = BorderStroke(1.dp, if (connectionMode == "wifi") AccentEmerald.copy(alpha = 0.6f) else BorderSubtle)
            ) {
              Row(
                modifier = Modifier.padding(vertical = 10.dp, horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                Icon(
                  imageVector = Icons.Outlined.Wifi,
                  contentDescription = "Wi-Fi",
                  tint = if (connectionMode == "wifi") AccentEmerald else TextSecondary,
                  modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(8.dp))
                Column {
                  Text(
                    "Wi-Fi LAN",
                    color = if (connectionMode == "wifi") AccentEmerald else TextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                  )
                  Text("Shared wireless network", color = TextMuted, fontSize = 9.sp)
                }
              }
            }
          }

          Spacer(Modifier.height(10.dp))

          // Host IP & Port Inputs
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            OutlinedTextField(
              value = serverIp,
              onValueChange = { serverIp = it },
              label = { Text("Desktop Host IP", fontSize = 10.sp) },
              singleLine = true,
              enabled = !isConnecting,
              modifier = Modifier.weight(2.5f),
              textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontFamily = FontFamily.Monospace, fontSize = 12.sp),
              colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = AccentEmerald,
                unfocusedBorderColor = BorderSubtle,
                focusedContainerColor = BgCard,
                unfocusedContainerColor = BgCard
              )
            )

            OutlinedTextField(
              value = serverPort,
              onValueChange = { serverPort = it },
              label = { Text("Port", fontSize = 10.sp) },
              singleLine = true,
              enabled = !isConnecting,
              modifier = Modifier.weight(1f),
              textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontFamily = FontFamily.Monospace, fontSize = 12.sp),
              colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = AccentEmerald,
                unfocusedBorderColor = BorderSubtle,
                focusedContainerColor = BgCard,
                unfocusedContainerColor = BgCard
              )
            )
          }

          if (connectionMode == "wifi") {
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
              onClick = { autoDetectDesktopIp() },
              enabled = !isConnecting,
              modifier = Modifier.fillMaxWidth(),
              shape = RoundedCornerShape(8.dp),
              border = BorderStroke(1.dp, AccentEmerald.copy(alpha = 0.4f))
            ) {
              Icon(
                imageVector = Icons.Default.Search,
                contentDescription = "Search",
                tint = AccentEmerald,
                modifier = Modifier.size(14.dp)
              )
              Spacer(Modifier.width(6.dp))
              Text("Auto-Detect Desktop IP", color = AccentEmerald, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
          }

          // Error Banner
          if (connectionError != null) {
            Spacer(Modifier.height(10.dp))
            Surface(
              color = Color(0x24EF4444),
              shape = RoundedCornerShape(8.dp),
              border = BorderStroke(1.dp, AccentDanger.copy(alpha = 0.4f)),
              modifier = Modifier.fillMaxWidth()
            ) {
              Row(
                modifier = Modifier.padding(10.dp),
                verticalAlignment = Alignment.Top
              ) {
                Icon(
                  imageVector = Icons.Default.Warning,
                  contentDescription = "Warning",
                  tint = AccentDanger,
                  modifier = Modifier.size(14.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                  connectionError ?: "",
                  color = Color(0xFFFFB4AB),
                  fontSize = 11.sp,
                  lineHeight = 15.sp
                )
              }
            }
          }

          Spacer(Modifier.height(12.dp))

          // Primary Connect Button
          Button(
            onClick = { connectToDesktop() },
            enabled = !isConnecting && serverIp.isNotBlank() && serverPort.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = AccentEmerald),
            shape = RoundedCornerShape(8.dp)
          ) {
            if (isConnecting) {
              CircularProgressIndicator(color = Color.Black, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
              Spacer(Modifier.width(8.dp))
              Text("Connecting to Desktop...", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            } else {
              Icon(
                imageVector = Icons.Outlined.Link,
                contentDescription = "Connect",
                tint = Color.Black,
                modifier = Modifier.size(16.dp)
              )
              Spacer(Modifier.width(8.dp))
              Text("Connect to Desktop", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
          }
        } else {
          // Connected State Details & Disconnect Action
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Column {
              Text(
                "Telemetry Link Synchronized",
                color = AccentEmerald,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp
              )
              Text(
                if (connectionMode == "usb") "Connected via USB Cable (ADB)" else "Connected via Local Wi-Fi LAN",
                color = TextMuted,
                fontSize = 11.sp
              )
            }

            OutlinedButton(
              onClick = { disconnectFromDesktop() },
              border = BorderStroke(1.dp, BorderSubtle),
              shape = RoundedCornerShape(6.dp),
              colors = ButtonDefaults.outlinedButtonColors(contentColor = TextSecondary),
              contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
            ) {
              Icon(
                imageVector = Icons.Outlined.LinkOff,
                contentDescription = "Disconnect",
                tint = TextSecondary,
                modifier = Modifier.size(14.dp)
              )
              Spacer(Modifier.width(6.dp))
              Text("Disconnect", fontSize = 11.sp, fontWeight = FontWeight.Medium)
            }
          }
        }
      }
    }

    // ==========================================
    // 3. SENTINEL LOCKOUT & DUAL-GATED BREAK CARD
    // ==========================================
    if (isLocked) {
      Surface(
        modifier = Modifier
          .fillMaxWidth()
          .padding(bottom = 14.dp),
        color = Color(0x28EF4444),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, AccentDanger.copy(alpha = 0.7f))
      ) {
        Column(
          modifier = Modifier.padding(16.dp),
          horizontalAlignment = Alignment.CenterHorizontally
        ) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
              imageVector = Icons.Outlined.Lock,
              contentDescription = "Locked",
              tint = AccentDanger,
              modifier = Modifier.size(18.dp)
            )
            Spacer(Modifier.width(8.dp))
            Text(
              "TIME TO TOUCH GRASS",
              color = AccentDanger,
              fontWeight = FontWeight.ExtraBold,
              fontSize = 14.sp,
              fontFamily = FontFamily.Monospace,
              letterSpacing = 0.5.sp
            )
          }

          Spacer(Modifier.height(6.dp))
          Text(
            "Focus threshold reached. Step away from your workstation for a mandatory 5-minute break and snap an outdoor photo.",
            color = TextPrimary,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            lineHeight = 17.sp
          )

          Spacer(Modifier.height(14.dp))

          // DUAL-GATED COOLDOWN CARD
          Surface(
            color = BgCard,
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, BorderSubtle),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(
              modifier = Modifier.padding(14.dp),
              horizontalAlignment = Alignment.CenterHorizontally
            ) {
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
              ) {
                Text(
                  "MANDATORY 5-MINUTE PAUSE",
                  color = TextMuted,
                  fontSize = 10.sp,
                  fontWeight = FontWeight.Bold,
                  fontFamily = FontFamily.Monospace
                )

                Surface(
                  color = if (breakSecondsRemaining <= 0) AccentEmerald.copy(alpha = 0.15f) else AccentAmber.copy(alpha = 0.15f),
                  shape = RoundedCornerShape(4.dp)
                ) {
                  Row(
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                  ) {
                    Icon(
                      imageVector = if (breakSecondsRemaining <= 0) Icons.Default.CheckCircle else Icons.Outlined.Timer,
                      contentDescription = null,
                      tint = if (breakSecondsRemaining <= 0) AccentEmerald else AccentAmber,
                      modifier = Modifier.size(10.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                      if (breakSecondsRemaining <= 0) "REST COMPLETED" else "REST IN PROGRESS",
                      color = if (breakSecondsRemaining <= 0) AccentEmerald else AccentAmber,
                      fontSize = 9.sp,
                      fontWeight = FontWeight.Bold
                    )
                  }
                }
              }

              Spacer(Modifier.height(8.dp))

              // Large Countdown Digits
              Text(
                formatTime(breakSecondsRemaining),
                color = if (breakSecondsRemaining <= 0) AccentEmerald else TextPrimary,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 32.sp
              )

              Spacer(Modifier.height(4.dp))
              Text(
                "Workstation thaws automatically after 5 minutes once outdoor nature is verified by Gemma AI.",
                color = TextMuted,
                fontSize = 10.sp,
                textAlign = TextAlign.Center
              )

              Spacer(Modifier.height(12.dp))

              // Dual-Gate Status Pills
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
              ) {
                // Gate 1: Outdoor Photo
                Surface(
                  modifier = Modifier.weight(1f),
                  color = if (isNatureVerified) AccentEmerald.copy(alpha = 0.12f) else Color(0x18FFFFFF),
                  shape = RoundedCornerShape(8.dp),
                  border = BorderStroke(1.dp, if (isNatureVerified) AccentEmerald.copy(alpha = 0.4f) else BorderSubtle)
                ) {
                  Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                  ) {
                    Icon(
                      imageVector = if (isNatureVerified) Icons.Default.Check else Icons.Outlined.Spa,
                      contentDescription = null,
                      tint = if (isNatureVerified) AccentEmerald else AccentAmber,
                      modifier = Modifier.size(12.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                      if (isNatureVerified) "Photo: Verified" else "Photo: Pending",
                      color = if (isNatureVerified) AccentEmerald else TextSecondary,
                      fontSize = 10.sp,
                      fontWeight = FontWeight.SemiBold
                    )
                  }
                }

                // Gate 2: Cooldown Timer
                Surface(
                  modifier = Modifier.weight(1f),
                  color = if (breakSecondsRemaining <= 0) AccentEmerald.copy(alpha = 0.12f) else Color(0x18FFFFFF),
                  shape = RoundedCornerShape(8.dp),
                  border = BorderStroke(1.dp, if (breakSecondsRemaining <= 0) AccentEmerald.copy(alpha = 0.4f) else BorderSubtle)
                ) {
                  Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                  ) {
                    Icon(
                      imageVector = if (breakSecondsRemaining <= 0) Icons.Default.Check else Icons.Outlined.Timer,
                      contentDescription = null,
                      tint = if (breakSecondsRemaining <= 0) AccentEmerald else AccentAmber,
                      modifier = Modifier.size(12.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                      if (breakSecondsRemaining <= 0) "Rest: Finished" else "Rest: Active",
                      color = if (breakSecondsRemaining <= 0) AccentEmerald else TextSecondary,
                      fontSize = 10.sp,
                      fontWeight = FontWeight.SemiBold
                    )
                  }
                }
              }
            }
          }
        }
      }
    } else {
      // Sentinel Monitoring Standby Card
      Surface(
        modifier = Modifier
          .fillMaxWidth()
          .padding(bottom = 14.dp),
        color = BgSurface,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, BorderSubtle)
      ) {
        Column(Modifier.padding(16.dp)) {
          Text(
            "SENTINEL MONITORING",
            color = AccentEmerald,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace
          )
          Spacer(Modifier.height(4.dp))
          Text(
            if (!isConnected) {
              "Connect to desktop to link real-time focus telemetry."
            } else if (targetAppCount > 0) {
              "$targetAppCount coding application(s) actively monitored on PC."
            } else {
              "Standby in background (workstation calm)."
            },
            color = TextSecondary,
            fontSize = 12.sp
          )
        }
      }
    }

    // ==========================================
    // 4. PROOF OF NATURE VIEWFINDER (LIVE CAMERA ONLY)
    // ==========================================
    Surface(
      modifier = Modifier
        .fillMaxWidth()
        .padding(bottom = 14.dp),
      color = BgSurface,
      shape = RoundedCornerShape(16.dp),
      border = BorderStroke(1.dp, BorderSubtle)
    ) {
      Column(
        modifier = Modifier.padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            "Outdoor Nature Proof",
            color = TextPrimary,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp
          )
          Surface(
            color = AccentAmber.copy(alpha = 0.15f),
            shape = RoundedCornerShape(4.dp)
          ) {
            Text(
              "GEMMA 4 VISION",
              color = AccentAmber,
              fontSize = 9.sp,
              fontFamily = FontFamily.Monospace,
              fontWeight = FontWeight.Bold,
              modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
            )
          }
        }

        Spacer(Modifier.height(4.dp))
        Text(
          "Direct camera capture only to guarantee authentic outdoor presence.",
          color = TextMuted,
          fontSize = 11.sp,
          modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(14.dp))

        // INTERACTIVE CAMERA VIEWFINDER FRAME
        Box(
          modifier = Modifier
            .fillMaxWidth()
            .height(230.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(BgCard)
            .border(
              BorderStroke(1.dp, if (capturedBitmap != null) AccentEmerald else BorderSubtle),
              RoundedCornerShape(12.dp)
            ),
          contentAlignment = Alignment.Center
        ) {
          if (capturedBitmap != null) {
            Image(
              bitmap = capturedBitmap!!.asImageBitmap(),
              contentDescription = "Outdoor Nature Photo",
              modifier = Modifier.fillMaxSize()
            )
          } else {
            // Viewfinder Empty Placeholder
            Column(
              horizontalAlignment = Alignment.CenterHorizontally,
              verticalArrangement = Arrangement.Center
            ) {
              Box(
                modifier = Modifier
                  .size(54.dp)
                  .clip(CircleShape)
                  .background(AccentEmerald.copy(alpha = 0.12f))
                  .border(BorderStroke(1.dp, AccentEmerald.copy(alpha = 0.4f)), CircleShape)
                  .clickable { triggerCamera() },
                contentAlignment = Alignment.Center
              ) {
                Icon(
                  imageVector = Icons.Outlined.PhotoCamera,
                  contentDescription = "Capture Photo",
                  tint = AccentEmerald,
                  modifier = Modifier.size(24.dp)
                )
              }
              Spacer(Modifier.height(10.dp))
              Text(
                "Tap to Open Camera",
                color = TextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
              )
              Text(
                "Point at outdoor foliage, trees, or open sky",
                color = TextMuted,
                fontSize = 11.sp
              )
            }
          }
        }

        Spacer(Modifier.height(14.dp))

        // CAMERA ACTIONS
        if (capturedBitmap == null) {
          Button(
            onClick = triggerCamera,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = AccentEmerald),
            shape = RoundedCornerShape(8.dp)
          ) {
            Icon(
              imageVector = Icons.Outlined.PhotoCamera,
              contentDescription = null,
              tint = Color.Black,
              modifier = Modifier.size(16.dp)
            )
            Spacer(Modifier.width(8.dp))
            Text("Open Camera & Capture Photo", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 13.sp)
          }
        } else {
          // Photo Captured -> Verify with Gemma AI or Retake
          Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
              onClick = {
                isVerifying = true
                scope.launch {
                  val result = withContext(Dispatchers.IO) {
                    try {
                      val origBmp = capturedBitmap!!
                      val maxDim = 800
                      val scaledBmp = if (origBmp.width > maxDim || origBmp.height > maxDim) {
                        val ratio = maxDim.toFloat() / maxOf(origBmp.width, origBmp.height)
                        Bitmap.createScaledBitmap(origBmp, (origBmp.width * ratio).toInt(), (origBmp.height * ratio).toInt(), true)
                      } else {
                        origBmp
                      }

                      val stream = ByteArrayOutputStream()
                      scaledBmp.compress(Bitmap.CompressFormat.JPEG, 75, stream)
                      val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)

                      val url = URL("http://$serverIp:$serverPort/api/verify-grass")
                      val conn = url.openConnection() as HttpURLConnection
                      conn.requestMethod = "POST"
                      conn.setRequestProperty("Content-Type", "application/json")
                      conn.setRequestProperty("User-Agent", "GrassLock-Android/1.0 (Dalvik Mobile Companion)")
                      conn.connectTimeout = 15000
                      conn.readTimeout = 40000
                      conn.doOutput = true
                      val payload = JSONObject().apply {
                        put("imageBase64", "data:image/jpeg;base64,$base64")
                        put("notes", "Photo of outdoor nature taken live from mobile camera")
                      }
                      conn.outputStream.write(payload.toString().toByteArray())
                      val resp = conn.inputStream.bufferedReader().readText()
                      JSONObject(resp)
                    } catch (e: Exception) {
                      val isTimeout = e is java.net.SocketTimeoutException
                      val detail = if (isTimeout) "AI processing timed out. Please retry." else "Connection to desktop interrupted: ${e.localizedMessage ?: e.message}"
                      JSONObject().apply {
                        put("success", false)
                        put("clientError", detail)
                      }
                    }
                  }

                  isVerifying = false
                  val isSuccess = result != null && result.optBoolean("success", false)
                  val isVerified = result?.optBoolean("verified", false) ?: false
                  val data = result?.optJSONObject("result")

                  if (isSuccess && isVerified) {
                    isConnected = true
                    connectionError = null
                    isNatureVerified = true
                    verificationResult = data?.optString("naturalistComment") ?: "Authentic outdoor nature verified by Google Gemma 4 AI."
                    verificationError = null
                    
                    val unlocked = result.optBoolean("unlocked", false)
                    if (unlocked) {
                      isLocked = false
                      Toast.makeText(context, "Outdoor verified and break completed. Workstation unlocked.", Toast.LENGTH_LONG).show()
                    } else {
                      val remainingSecs = result.optInt("breakSecondsRemaining", breakSecondsRemaining)
                      breakSecondsRemaining = remainingSecs
                      Toast.makeText(context, "Outdoor photo verified. Mandatory 5-minute break is still ticking down.", Toast.LENGTH_LONG).show()
                    }
                  } else {
                    if (result != null && result.has("result")) {
                      isConnected = true
                      connectionError = null
                    }
                    val clientErr = result?.optString("clientError")
                    val rawMsg = if (!clientErr.isNullOrBlank()) clientErr
                      else data?.optString("naturalistComment")
                        ?: if (result != null) "Photo did not meet outdoor nature criteria. Please capture outdoor plants or trees."
                           else "Failed to reach desktop at http://$serverIp:$serverPort. Check network connection."
                    val errMsg = if (rawMsg.contains("```") || rawMsg.trim().startsWith("{") || rawMsg.contains("\"verified\"")) {
                      "Photo did not satisfy outdoor foliage or sky criteria. Please point camera at outdoor plants, foliage, or open sky."
                    } else {
                      rawMsg
                    }
                    verificationError = errMsg
                    verificationResult = null
                  }
                }
              },
              modifier = Modifier.fillMaxWidth(),
              colors = ButtonDefaults.buttonColors(containerColor = AccentEmerald),
              enabled = !isVerifying,
              shape = RoundedCornerShape(8.dp)
            ) {
              if (isVerifying) {
                CircularProgressIndicator(color = Color.Black, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(8.dp))
                Text("Evaluating with Gemma 4 Vision...", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 12.sp)
              } else {
                Icon(
                  imageVector = Icons.Outlined.AutoAwesome,
                  contentDescription = null,
                  tint = Color.Black,
                  modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text("Verify with Google Gemma AI", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 13.sp)
              }
            }

            OutlinedButton(
              onClick = triggerCamera,
              modifier = Modifier.fillMaxWidth(),
              border = BorderStroke(1.dp, BorderSubtle),
              shape = RoundedCornerShape(8.dp),
              colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary)
            ) {
              Icon(
                imageVector = Icons.Default.Refresh,
                contentDescription = null,
                tint = TextPrimary,
                modifier = Modifier.size(14.dp)
              )
              Spacer(Modifier.width(6.dp))
              Text("Retake Photo", fontSize = 12.sp, fontWeight = FontWeight.Medium)
            }
          }
        }
      }
    }

    // ==========================================
    // 5. VERIFICATION REJECTION CARD
    // ==========================================
    AnimatedVisibility(
      visible = verificationError != null,
      enter = fadeIn(),
      exit = fadeOut()
    ) {
      Surface(
        modifier = Modifier
          .fillMaxWidth()
          .padding(bottom = 16.dp),
        color = Color(0x26EF4444),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, AccentDanger.copy(alpha = 0.6f))
      ) {
        Column(Modifier.padding(16.dp)) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
              Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = "Warning",
                tint = AccentDanger,
                modifier = Modifier.size(14.dp)
              )
              Spacer(Modifier.width(6.dp))
              Text(
                "VERIFICATION REJECTED",
                color = AccentDanger,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace
              )
            }
            Text("Screen Remains Locked", color = AccentDanger, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
          }
          Spacer(Modifier.height(6.dp))
          Text(verificationError ?: "", color = Color(0xFFFFB4AB), fontSize = 12.sp, lineHeight = 17.sp)
          Spacer(Modifier.height(6.dp))
          Text("Point your camera at outdoor trees, plants, or sky, and capture another photo.", color = TextMuted, fontSize = 11.sp)
        }
      }
    }

    // ==========================================
    // 6. VERIFICATION SUCCESS CARD (No Git Commits)
    // ==========================================
    AnimatedVisibility(
      visible = verificationResult != null,
      enter = fadeIn(),
      exit = fadeOut()
    ) {
      Surface(
        modifier = Modifier
          .fillMaxWidth()
          .padding(bottom = 16.dp),
        color = Color(0x1F22C55E),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, AccentEmerald.copy(alpha = 0.5f))
      ) {
        Column(Modifier.padding(16.dp)) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
              Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = "Verified",
                tint = AccentEmerald,
                modifier = Modifier.size(15.dp)
              )
              Spacer(Modifier.width(6.dp))
              Text(
                "OUTDOOR NATURE VERIFIED",
                color = AccentEmerald,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace
              )
            }
            Text("Streak: +1 Day", color = AccentEmerald, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
          }
          Spacer(Modifier.height(6.dp))
          Text(verificationResult ?: "", color = TextPrimary, fontSize = 13.sp, lineHeight = 18.sp)
          if (isLocked && breakSecondsRemaining > 0) {
            Spacer(Modifier.height(8.dp))
            Surface(
              color = BgCard,
              shape = RoundedCornerShape(6.dp),
              modifier = Modifier.fillMaxWidth()
            ) {
              Text(
                "Outdoor photo verified. Workstation thaws once the 5-minute break timer concludes.",
                color = TextSecondary,
                fontSize = 11.sp,
                modifier = Modifier.padding(8.dp)
              )
            }
          }
        }
      }
    }
  }
}
