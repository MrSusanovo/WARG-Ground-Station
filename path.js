var Path = (function ($, Data, Log, Network) {
    // Camera FOV: horz 94.38, vert 78.3

    var exports = {};

    // Data objects here: array of L.LatLng objects
    var waypoints = [];
    exports.testPlaneWaypointIndex = null;

    var WAYPOINT_HOME = 255;
    var WAYPOINT_LEGACY_RADIUS = 13.1415926;    // Just a number here in case plane uses legacy waypoint following

    // Interactive objects here
    var map;
    var graph;
    
    // Initialize map if necessary
    $(document).ready(function () {
        if (!map) {
            map = L.map('map').setView([43.53086, -80.5772], 17);
            map.attributionControl.setPrefix(false);

            L.tileLayer('sat_tiles/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(map);
        }
    });

    // Handle button clicks
    $(document).ready(function () {

        $('#lockOn').on('click', function () {
            // TODO Decouple this from plane marker & figure out somewhere to store last "sensible GPS coordinates"
            // (to prevent bug with erroneous GPS coordinates crashing Leaflet)
            if (planeMarker) {
                map.panTo(planeMarker.getLatLng());
            }
        });

        $('#clearWaypoints').on('click', function () {
            // Clear all waypoints in localPath
            localPath.setLatLngs([]);
            
            redrawMap();
        });

        $('#sendWaypoints').on('click', function () {

            // Move past waypoints from remotePath into passedPath
            var passedLatLngs = passedPath.getLatLngs().concat(
                remotePath.getLatLngs().filter(function (latlng, index) {
                    return index < remotePath.getNextIndex();
                })
            );
            passedPath.setLatLngs(passedLatLngs);

            // Retain only future waypoints in localPath (delete all past ones)
            var localLatLngs = localPath.getLatLngs().filter(function (latlng, index) {
                return index >= localPath.getNextIndex();
            });
            localPath.setLatLngs(localLatLngs);
            localPath.setNextIndex(0);

            // Replace waypoints in remotePath with those from localPath
            var remoteLatLngs = localPath.getLatLngs().map(function (latlng, index) {
                return new L.LatLng(latlng.lat, latlng.lng, latlng.alt);    // Clone object
            });
            remotePath.setLatLngs(remoteLatLngs);
            remotePath.setNextIndex(0);

            // Hack to force localPath to redraw its markers (so they reappear on top)
            localPath.setNextIndex(localPath.getNextIndex());

            // Clear current waypoints on plane
            var command = "clear_waypoints:0\r\n";
            Network.write(command);
            
            // Upload new waypoints; or if no new waypoints, order to go home
            var remoteLatLngs = remotePath.getLatLngs();
            if (remoteLatLngs.length) {
                var targetWaypointIsSent = false;
                var targetWaypointIndex = remotePath.getNextIndex();

                for (i = 0, l = remoteLatLngs.length; i < l; i++) {
                    var latLng = remoteLatLngs[i];
                    command = "new_Waypoint:" + latLng.lat + "," + latLng.lng + "," + latLng.alt + "," + WAYPOINT_LEGACY_RADIUS + "\r\n";
                    Network.write(command);

                    if (i == targetWaypointIndex) {
                        command = "set_targetWaypoint:" + targetWaypointIndex + "\r\n";
                        Network.write(command);
                        targetWaypointIsSent = true;
                    }
                }

                if (!targetWaypointIsSent) {
                    command = "set_targetWaypoint:" + targetWaypointIndex + "\r\n";
                    Network.write(command);
                    console.warn('Sent target waypoint', targetWaypointIndex, 'probably out of range of waypoint list, length', remoteLatLngs.length);
                }

            } else {
                // Probably uploading just after clearing waypoints; go home then.
                // TODO Or even just do nothing -- clearing waypoints makes plane automatically go home
                command = "return_home:0\r\n";
                Network.write(command);
            }

            // If we're overriding the waypointIndex we receive from plane, then simulate it accordingly
            if (exports.testPlaneWaypointIndex !== null) {
                exports.testPlaneWaypointIndex = remotePath.getNextIndex();
            }
        });

        $('#goHome').on('click', function () {
            var command = "return_home:0\r\n";
            Network.write(command);
        });
    });

    var planeIcon;
    var planeHollowIcon;
    var planeMarker;
    var gpsFixMessagebox;
    var passedPath; // Contains any wpts we're sure to have already passed (flown over)
    var localPath;  // Contains local working copy of what we're planning
    var remotePath; // Contains any wpts currently on plane & index of wpt plane is travelling to
    var remoteToLocal;  // Line connecting current waypoint on plane to next local waypoint
    var passedToRemote; // Line connecting end of passedPath to begining of remotePath
    var planeToNextRemote;  // Line connecting current plane position to next waypoint on plane
    var historyPolyline;

    Network.on('data', redrawMap);

    function redrawMap() {

        var lat = parseFloat(Data.state.lat);
        var lon = parseFloat(Data.state.lon);

        // Check for GPS fix, assuming we'll never fly off the coast of West Africa
        // (No GPS fix if coordinates close to (0; 0) or impossibly big)
        var gpsFix = (Math.abs(lat) > 1) && (Math.abs(lon) > 1) && (Math.abs(lat) < 360) && (Math.abs(lon) < 360);
        
        var heading = Data.state.heading;
        var yaw = Data.state.yaw;
        var waypointIndex = Data.state.waypointIndex;

        // Init icons for planeMarker if necessary
        if (!planeIcon) {
            planeIcon = L.icon({
                iconUrl: 'plane.png',
                iconSize: [30, 30],
            });
        }
        if (!planeHollowIcon) {
            planeHollowIcon = L.icon({
                iconUrl: 'plane-hollow.png',
                iconSize: [30, 30],
                title: 'No GPS fix',
            });
        }

        // Init planeMarker if necessary
        if (!planeMarker) {
            planeMarker = new L.RotatedMarker([lat, lon], {
                icon: planeIcon,
            }).addTo(map);
        }

        // Init messagebox about GPS fix
        if (!gpsFixMessagebox) {
            gpsFixMessagebox = L.control.messagebox({
                timeout: null,
                className: 'messagebox-gpsfix',
            }).addTo(map);
        }

        // Init passedPath if necessary
        if (!passedPath) {
            passedPath = L.Polyline.Plotter([], {
                readOnly: true,
                future:  {color: '#ff00ff', weight: 5, opacity: 0.1, clickable: false},  // Shouldn't ever appear
                present: {color: '#ff00ff', weight: 5, opacity: 0.1, clickable: false},  // Shouldn't ever appear
                past:    {color: '#09092e', weight: 5, opacity: 1, clickable: false},
            }).addTo(map);
            passedPath.setNextIndex(Number.MAX_SAFE_INTEGER);
            exports.passedPath = passedPath;
        }

        // Init localPath if necessary
        if (!localPath) {
            localPath = L.Polyline.Plotter(waypoints, {
                future:  {color: '#f21818', weight: 4, opacity: 1, dashArray: '3, 6'},
                present: {color: '#ff00ff', weight: 5, opacity: 0.1, clickable: false},  // Shouldn't ever appear
                past:    {color: '#ff00ff', weight: 5, opacity: 0.1, clickable: false},  // Shouldn't ever appear
            }).addTo(map);
            localPath.setNextIndex(0);
            exports.localPath = localPath;
        }

        // Init remotePath if necessary
        if (!remotePath) {
            remotePath = L.Polyline.Plotter([], {
                readOnly: true,
                future:  {color: '#1a1a80', weight: 5, opacity: 1, clickable: false, dashArray: '3, 6'},
                present: {color: '#09092e', weight: 5, opacity: 1, clickable: false},
                past:    {color: '#09092e', weight: 5, opacity: 1, clickable: false},
            }); // Not adding to map yet; we want to add this last.
            exports.remotePath = remotePath;
        }

        // Init remoteToLocal if necessary
        if (!remoteToLocal) {
            remoteToLocal = L.polyline([], {
                color: '#f21818', weight: 4, opacity: 1, clickable: false
            }).addTo(map);
            exports.remoteToLocal = remoteToLocal;

            // When remote or local line changes, update this line
            var updateRemoteToLocal = function () {
                if (remotePath.getNextIndex() == 0) {
                    var start = passedPath.getLatLngs()[passedPath.getLatLngs().length-1];  // "Wrap around" to passedPath
                } else {
                    var start = remotePath.getLatLngs()[remotePath.getNextIndex()-1];
                }
                setLineEndpoints(remoteToLocal,
                    start,
                    localPath.getLatLngs()[localPath.getNextIndex()]
                );
            };
            remotePath.on('change drag', updateRemoteToLocal);
            localPath.on('change drag', updateRemoteToLocal);
        }

        // Init passedToRemote if necessary
        if (!passedToRemote) {
            passedToRemote = L.polyline([], {
                color: '#09092e', weight: 5, opacity: 1, clickable: false
            }).addTo(map);
            exports.passedToRemote = passedToRemote;

            // When passed or remote line changes, update this line
            var updatePassedToRemote = function () {
                setLineEndpoints(passedToRemote,
                    passedPath.getLatLngs()[passedPath.getLatLngs().length-1],
                    remotePath.getLatLngs()[0]
                );
            };
            passedPath.on('change drag', updatePassedToRemote);
            remotePath.on('change drag', updatePassedToRemote);
        }

        // Init planeToNextRemote if necessary
        if (!planeToNextRemote) {
            planeToNextRemote = L.polyline([], {
                color: '#1a1a80', weight: 5, opacity: 1, clickable: false, dashArray: '3, 6',
            }).addTo(map);
            exports.planeToNextRemote = planeToNextRemote;

            // When waypoints change, update line going from plane to next waypoint
            remotePath.on('change drag', function(e) {
                setLineEndpoints(planeToNextRemote, planeMarker.getLatLng(), remotePath.getNextLatLng());
                if (!remotePath.getNextLatLng()) {
                    console.log('planeToNextRemote not visible because remotePath has no next waypoint');
                }
            });
        }

        // Init historyPolyline if necessary
        if (!historyPolyline) {
            historyPolyline = new L.Polyline([], {
                color: '#190019', opacity: 0.6, weight: 4, clickable: false,
            }).addTo(map);
        }

        // Add remotePath to top-most z-index of map
        if (!map.hasLayer(remotePath)) {
            remotePath.addTo(map);
        }


        // Update plane marker
        if (gpsFix) {
            planeMarker.setIcon(planeIcon);
            planeMarker.setLatLng(new L.LatLng(lat, lon));
            planeMarker.options.angle = yaw*1 + 180;    // FIXME Make this more consistent across all files
            planeMarker.update();
        } else {
            planeMarker.setIcon(planeHollowIcon);
        }
        planeMarker._icon.title = lat + "°, " + lon + "°\nyaw " + Math.round(yaw) + "°, hdg " + heading + "°\nnext-wpt: " + waypointIndex + (waypointIndex == WAYPOINT_HOME ? " (home)" : "");
        
        // Update gpsFix message box
        if (gpsFix) {
            gpsFixMessagebox.hide();
        } else {
            gpsFixMessagebox.show('No GPS fix');
        }

        // Update which waypoint we're targeting next & redraw lines accordingly
        if (exports.testPlaneWaypointIndex !== null) {
            // You can override waypointIndex received from plane by console-setting Path.testPlaneWaypointIndex
            waypointIndex = exports.testPlaneWaypointIndex;
        }
        if (remotePath.getNextIndex() != waypointIndex && waypointIndex != WAYPOINT_HOME) {
            // TODO Manage going home case

            remotePath.setNextIndex(waypointIndex);

            var firstDifferentIndex = findFirstLocalDifferent(localPath, remotePath);
            localPath.setNextIndex(Math.min(waypointIndex, firstDifferentIndex));
        }
        
        // When plane moves, update line going from plane to next waypoint
        if (gpsFix) {
            setLineEndpoints(planeToNextRemote, {lat: lat, lng: lon}, remotePath.getNextLatLng());
        } else {
            planeToNextRemote.setLatLngs([]);
        }

        // Draw points on historyPolyline
        if (gpsFix) {
            historyPolyline.addLatLng(L.latLng(lat, lon));
        }
    }

    // Init function to set endpoints of a line segment
    var setLineEndpoints = function (polyline, start, end) {
        if (start && end) {
            polyline.setLatLngs([start, end]);
        } else {
            polyline.setLatLngs([]);
        }
    };

    // Return index of first different waypoint in localPath
    var findFirstLocalDifferent = exports.findFirstLocalDifferent = function (localPath, remotePath) {
        var localLatLngs = localPath.getLatLngs();
        var remoteLatLngs = remotePath.getLatLngs();
        for (var i = 0; i < localLatLngs.length; ++i) {
            if (!remoteLatLngs[i]) {
                return i;
            }
            if (localLatLngs[i].lat != remoteLatLngs[i].lat && localLatLngs[i].lng != remoteLatLngs[i].lng) {
                return i;
            }
        }
        return i;
    };

    // Export what needs to be
    return exports;

})($, Data, Log, Network);