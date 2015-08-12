/**
 * angular-sqlite 
 * Based on angular-websql
 * Helps you generate and run sqlite queries with angular services and sqlite plugin for cordova (Need ngCordova).
 *
 * NOTE! If SQLite plugin is not found, try use WebSQL.
 * 
 * ngCordova: http://ngcordova.com/docs/#SQLite
 * SQLite plugin: https://github.com/brodysoft/Cordova-SQLitePlugin
 *
 * © MIT License
 * @version 1.0.0
 */
"use strict";
angular.module("angular-sqlite", ['ngCordova'])
.provider('$sqliteConfig',[  function(){

	var config = {
		enableLog : false,
		resetDatabase : false,
		setGlobal : false,
		dbName : 'Default.db'
	};

	this.$get = function(){
		return config;
	};

	this.setConfig = function(_config){
		angular.extend(config, _config);
	};

}])
.factory("$sqlite", [
	"$q", 
	"$cordovaSQLite",
	'$sqliteConfig',
function(
	$q, 
	$cordovaSQLite,
	$sqliteConfig
){

		var _objDB = null;
		var rnd = null;

		return {
			isSqlLite : function(){
				return (typeof window.sqlitePlugin !== "undefined");
			},
			getDB : function(dbName, resetDB, log, global){
				if(_objDB == null){ 
					_objDB = this.openDatabase(dbName, resetDB, log, global);
				}
				return _objDB;
			},
			openDatabase: function(dbName, resetDB, log, global) {
				try {
					
					if(typeof dbName == 'undefined') dbName = $sqliteConfig.dbName;

					if(dbName.indexOf('.db') < 0) dbName += '.db';

					if(typeof log == "undefined") 	  	log = $sqliteConfig.enableLog;
					if(typeof resetDB == "undefined") 	resetDB = $sqliteConfig.resetDB;
					if(typeof global == "undefined") 	global = $sqliteConfig.setGlobal;

					var isWebBrowser = false;
					if(typeof window.sqlitePlugin == "undefined") isWebBrowser = true;

					if(resetDB && !isWebBrowser)
						window.sqlitePlugin.deleteDatabase(dbName, function(){ }, function(err){ });

					if(!isWebBrowser){
						var db = $cordovaSQLite.openDB(dbName);
					}else{
						console.log('## USING WEBSQLITE');
						var db = openDatabase(dbName, '1.0', 'Desc', 25*1024*1024);
					}
					
					if (!db) throw "Error on create database";

					if(global){
						window.db = db;
						window.execSQL = function(sql){
							$cordovaSQLite.execute(db, sql).then(function(res){
								for (var i = 0; i < res.rows.length; i++) {
									console.log('## GLOBAL DB LOG', res.rows.item(i));
								};
							},function(err){
								console.error('## GLOBAL DB ERROR LOG', err);
							});
						}
					}

					return {
						executeQuery: function(query, values) {
							if(log) console.log('## DATABASE LOG', query, values);

							//AVOID UNDEFINEDS QUERIES
							var deferredTemp = $q.defer();
							deferredTemp.reject(new Error('query null'));
							if(typeof query == 'undefined') return deferredTemp.promise;

							return $cordovaSQLite.execute(db, query, values);

						},
						insert: function(c, e, r) {
							var f = (typeof r === "boolean" && r) ? "INSERT OR REPLACE" : "INSERT";
							f += " INTO `{tableName}` ({fields}) VALUES({values});";
							var a = "",
							b = "",
							v = [];
							for (var d in e) {
								a += (Object.keys(e)[Object.keys(e).length - 1] == d) ? "`" + d + "`" : "`" + d + "`, ";
								b += (Object.keys(e)[Object.keys(e).length - 1] == d) ? "?" : "?, ";
								v.push(e[d]);
							}
							return this.executeQuery(this.replace(f, {
								"{tableName}": c,
								"{fields}": a,
								"{values}": b
							}), v);
						},
						update: function(b, g, c) {
							var f = "UPDATE `{tableName}` SET {update} WHERE {where}; ";
							var e = "";
							var v = [];
							for (var d in g) {
								e += (Object.keys(g)[Object.keys(g).length - 1] == d) ? "`" + d + "`= ?" : "`" + d + "`= ?,";
								v.push(g[d]);
							}
							var a = this.whereClause(c);
							return this.executeQuery(this.replace(f, {
								"{tableName}": b,
								"{update}": e,
								"{where}": a.w
							}), v.concat(a.p));
						},
						del: function(b, c) {
							if (c){
								var d = "DELETE FROM `{tableName}` WHERE {where}; ";
								var a = this.whereClause(c);
							}else{
								var d = "DELETE FROM `{tableName}`;";
								var a = {p : []};
							}
							return this.executeQuery(this.replace(d, {
								"{tableName}": b,
								"{where}": a.w
							}), a.p);
						},
						select: function(b, c, orderby, limit) {

							var d = "SELECT * FROM `{tableName}`";

							if(c) d += " WHERE {where}";
							if(orderby) d += " ORDER BY {orderBy}";
							if(limit){

								d += " LIMIT ";

								if(limit.offset !== undefined) d += limit.offset + ',';
								if(limit.limit !== undefined) d += limit.limit;

							}
							d += ";";

							var strOrderby = "";
							if(orderby){

								angular.forEach(orderby, function(val, key){
									if(strOrderby != '') 
										strOrderby += ', ';
									
									//22/05/2015 - Jefferson Santos - Realizado correção para montar array de campo do order by
									// strOrderby += key + ' ' + val;
									strOrderby += val.campo + ' ' + val.order; 
								});	

							}

							var a = this.whereClause(c);
							return this.executeQuery(this.replace(d, {
								"{tableName}": b,
								"{where}": a.w,
								"{orderBy}" : strOrderby
							}), a.p);

						},
						selectAll: function(a) {
							return this.executeQuery("SELECT * FROM `" + a + "`; ", []);
						},
						whereClause: function(b) {
							var a = "",
							v = [];
							for (var c in b) {
								if(typeof b[c] !== "undefined" && typeof b[c] !== "object" && typeof b[c] === "string" && !b[c].match(/NULL/ig)) v.push(b[c]);
								else if(typeof b[c] !== "undefined" && typeof b[c] !== "object" && typeof b[c] === "number") v.push(b[c]);
								else if(typeof b[c]["value"] !== "undefined" && typeof b[c] === "object" && (typeof b[c]["value"] === "number" || !b[c]["value"].match(/NULL/ig))) v.push(b[c]["value"]);
								a += (typeof b[c] === "object") ? 
												(typeof b[c]["union"] === "undefined") ? 
													(typeof b[c]["value"] === "string" && b[c]["value"].match(/NULL/ig)) ? 
														"`" + c + "` " + b[c]["value"] : 
														(typeof b[c]["operator"] !== "undefined")?
															"`" + c + "` " + b[c]["operator"] + " ? " : 
															"`" + c + "` = ?" : 
													(typeof b[c]["value"] === "string" && b[c]["value"].match(/NULL/ig)) ? 
															"`" + c + "` " + b[c]["value"] + " " + b[c]["union"] + " " : 
															(typeof b[c]["operator"] !== "undefined") ? 
																"`" + c + "` " + b[c]["operator"] + " ? " + b[c]["union"] + " " : 
																"`" + c + "` = ? " + b[c]["union"] + " " : 
												(typeof b[c] === "string" && b[c].match(/NULL/ig)) ? 
													"`" + c + "` " + b[c] : 
													"`" + c + "` = ?"
							}
							return {w:a,p:v};
						},
						replace: function(a, c) {
							for (var b in c) {
								a = a.replace(new RegExp(b, "ig"), c[b])
							}
							return a;
						},
						createTable: function(j, g) {
							var b = "CREATE TABLE IF NOT EXISTS `{tableName}` ({fields}); ";
							var c = [];
							var a = "";
							var addPrimaryEnd = true;
							for (var e in g) {
								var l = "{type} {null}";
								a += "`" + e + "` ";
								if(typeof g[e]["null"]==="undefined") g[e]["null"]="NULL";
								for (var k in g[e]) {
									l = l.replace(new RegExp("{" + k + "}", "ig"), g[e][k])
								}
								a += l;
								if (typeof g[e]["default"] !== "undefined") {
									a += " DEFAULT " + g[e]["default"]
								}
								
								if (typeof g[e]["auto_increment"] !== "undefined") {

									if (typeof g[e]["primary"] !== "undefined") {
										a += " PRIMARY KEY";
										addPrimaryEnd = false;
									}

									a += " AUTOINCREMENT";
								}
								if (Object.keys(g)[Object.keys(g).length - 1] != e) {
									a += ","
								}
								if (typeof g[e]["primary"] !== "undefined" && g[e]["primary"]) {
									c.push(e)
								}

							}

							if(c.length > 0 && addPrimaryEnd){
								var primary ='PRIMARY KEY (';
								for (var i = 0; i < c.length; i++) {
									primary += c[i];
									if( i < c.length-1) primary += ',';
								};
								primary += ')';
								a += ',' + primary;
							}

							var d = {
								tableName: j,
								fields: a
							};
							for (var f in d) {
								b = b.replace(new RegExp("{" + f + "}", "ig"), d[f])
							}
							return this.executeQuery(b, []);
						},
						dropTable: function(a) {
							return this.executeQuery("DROP TABLE IF EXISTS `" + a + "`; ", []);
						},
					};
				} catch (err) {
					console.error(err);
				}
			}
		}
	}
])
;
