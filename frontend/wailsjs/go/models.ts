export namespace browsermcp {

	export class Status {
	    enabled: boolean;
	    running: boolean;
	    endpoint: string;
	    message: string;
	    command: string;

	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.running = source["running"];
	        this.endpoint = source["endpoint"];
	        this.message = source["message"];
	        this.command = source["command"];
	    }
	}

}

export namespace chat {

	export class AppleStatus {
	    available: boolean;
	    reason: string;

	    static createFrom(source: any = {}) {
	        return new AppleStatus(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.reason = source["reason"];
	    }
	}
	export class ModelInfo {
	    id: string;
	    name: string;
	    creator: string;
	    provider: string;
	    max_tokens: number;
	    chat: boolean;
	    tools: boolean;

	    static createFrom(source: any = {}) {
	        return new ModelInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.creator = source["creator"];
	        this.provider = source["provider"];
	        this.max_tokens = source["max_tokens"];
	        this.chat = source["chat"];
	        this.tools = source["tools"];
	    }
	}
	export class Config {
	    apple: AppleStatus;
	    local_model: ModelInfo;
	    providers: Record<string, boolean>;
	    favorites: ModelInfo[];
	    selected: number;
	    configured: boolean;
	    model: string;
	    max_tokens: number;

	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apple = this.convertValues(source["apple"], AppleStatus);
	        this.local_model = this.convertValues(source["local_model"], ModelInfo);
	        this.providers = source["providers"];
	        this.favorites = this.convertValues(source["favorites"], ModelInfo);
	        this.selected = source["selected"];
	        this.configured = source["configured"];
	        this.model = source["model"];
	        this.max_tokens = source["max_tokens"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ToolFunction {
	    name: string;
	    arguments: string;

	    static createFrom(source: any = {}) {
	        return new ToolFunction(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.arguments = source["arguments"];
	    }
	}
	export class ToolCall {
	    trace?: string[];
	    id: string;
	    type: string;
	    function: ToolFunction;

	    static createFrom(source: any = {}) {
	        return new ToolCall(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.trace = source["trace"];
	        this.id = source["id"];
	        this.type = source["type"];
	        this.function = this.convertValues(source["function"], ToolFunction);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Message {
	    provider?: string;
	    model?: string;
	    role: string;
	    content: string;
	    tool_calls?: ToolCall[];
	    tool_call_id?: string;

	    static createFrom(source: any = {}) {
	        return new Message(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.model = source["model"];
	        this.role = source["role"];
	        this.content = source["content"];
	        this.tool_calls = this.convertValues(source["tool_calls"], ToolCall);
	        this.tool_call_id = source["tool_call_id"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Conversation {
	    context_notice?: string;
	    activity?: string;
	    id: string;
	    title: string;
	    updated: number;
	    revision: number;
	    messages: Message[];
	    status: string;
	    error: string;
	    finish: string;

	    static createFrom(source: any = {}) {
	        return new Conversation(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.context_notice = source["context_notice"];
	        this.activity = source["activity"];
	        this.id = source["id"];
	        this.title = source["title"];
	        this.updated = source["updated"];
	        this.revision = source["revision"];
	        this.messages = this.convertValues(source["messages"], Message);
	        this.status = source["status"];
	        this.error = source["error"];
	        this.finish = source["finish"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}


	export class Summary {
	    id: string;
	    title: string;
	    updated: number;
	    status: string;

	    static createFrom(source: any = {}) {
	        return new Summary(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.updated = source["updated"];
	        this.status = source["status"];
	    }
	}


}

export namespace search {

	export class FAQ {
	    q: string;
	    a: string;
	    url: string;

	    static createFrom(source: any = {}) {
	        return new FAQ(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.q = source["q"];
	        this.a = source["a"];
	        this.url = source["url"];
	    }
	}
	export class Info {
	    title: string;
	    url: string;
	    thumb: string;
	    host: string;
	    desc: string;
	    attrs: string[][];

	    static createFrom(source: any = {}) {
	        return new Info(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.url = source["url"];
	        this.thumb = source["thumb"];
	        this.host = source["host"];
	        this.desc = source["desc"];
	        this.attrs = source["attrs"];
	    }
	}
	export class News {
	    title: string;
	    url: string;
	    host: string;
	    age: string;
	    thumb: string;
	    favicon: string;

	    static createFrom(source: any = {}) {
	        return new News(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.url = source["url"];
	        this.host = source["host"];
	        this.age = source["age"];
	        this.thumb = source["thumb"];
	        this.favicon = source["favicon"];
	    }
	}
	export class Video {
	    title: string;
	    url: string;
	    host: string;
	    age: string;
	    thumb: string;
	    duration: string;

	    static createFrom(source: any = {}) {
	        return new Video(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.url = source["url"];
	        this.host = source["host"];
	        this.age = source["age"];
	        this.thumb = source["thumb"];
	        this.duration = source["duration"];
	    }
	}
	export class Result {
	    title: string;
	    url: string;
	    host: string;
	    path: string;
	    favicon: string;
	    desc: string;
	    extra: string[];
	    age: string;
	    thumb: string;

	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.url = source["url"];
	        this.host = source["host"];
	        this.path = source["path"];
	        this.favicon = source["favicon"];
	        this.desc = source["desc"];
	        this.extra = source["extra"];
	        this.age = source["age"];
	        this.thumb = source["thumb"];
	    }
	}
	export class Page {
	    query: string;
	    altered: string;
	    results: Result[];
	    info?: Info;
	    news: News[];
	    videos: Video[];
	    faq: FAQ[];
	    more: boolean;
	    millis: number;

	    static createFrom(source: any = {}) {
	        return new Page(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.query = source["query"];
	        this.altered = source["altered"];
	        this.results = this.convertValues(source["results"], Result);
	        this.info = this.convertValues(source["info"], Info);
	        this.news = this.convertValues(source["news"], News);
	        this.videos = this.convertValues(source["videos"], Video);
	        this.faq = this.convertValues(source["faq"], FAQ);
	        this.more = source["more"];
	        this.millis = source["millis"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}


}

export namespace sonos {

	export class Device {
	    id: string;
	    name: string;
	    model: string;
	    online: boolean;

	    static createFrom(source: any = {}) {
	        return new Device(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.model = source["model"];
	        this.online = source["online"];
	    }
	}
	export class Status {
	    devices: Device[];
	    selected: string[];
	    enabled: boolean;
	    scanning: boolean;
	    supported: boolean;
	    message: string;

	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.devices = this.convertValues(source["devices"], Device);
	        this.selected = source["selected"];
	        this.enabled = source["enabled"];
	        this.scanning = source["scanning"];
	        this.supported = source["supported"];
	        this.message = source["message"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace spotify {

	export class NextStatus {
	    uri: string;
	    title: string;
	    status: string;
	    message?: string;

	    static createFrom(source: any = {}) {
	        return new NextStatus(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uri = source["uri"];
	        this.title = source["title"];
	        this.status = source["status"];
	        this.message = source["message"];
	    }
	}
	export class State {
	    uri?: string;
	    status: string;
	    message?: string;
	    title?: string;
	    artist?: string;
	    album?: string;
	    duration: number;
	    position: number;
	    artwork?: string;
	    volume: number;
	    shuffle: boolean;
	    repeat: boolean;

	    static createFrom(source: any = {}) {
	        return new State(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uri = source["uri"];
	        this.status = source["status"];
	        this.message = source["message"];
	        this.title = source["title"];
	        this.artist = source["artist"];
	        this.album = source["album"];
	        this.duration = source["duration"];
	        this.position = source["position"];
	        this.artwork = source["artwork"];
	        this.volume = source["volume"];
	        this.shuffle = source["shuffle"];
	        this.repeat = source["repeat"];
	    }
	}

}

export namespace spotifyapi {

	export class Artist {
	    name: string;
	    uri: string;
	    images: Image[];

	    static createFrom(source: any = {}) {
	        return new Artist(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uri = source["uri"];
	        this.images = this.convertValues(source["images"], Image);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Image {
	    url: string;

	    static createFrom(source: any = {}) {
	        return new Image(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	    }
	}
	export class Album {
	    name: string;
	    uri: string;
	    images: Image[];
	    artists: Artist[];
	    release_date: string;

	    static createFrom(source: any = {}) {
	        return new Album(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uri = source["uri"];
	        this.images = this.convertValues(source["images"], Image);
	        this.artists = this.convertValues(source["artists"], Artist);
	        this.release_date = source["release_date"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AlbumPage {
	    items: Album[];

	    static createFrom(source: any = {}) {
	        return new AlbumPage(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], Album);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class ArtistPage {
	    items: Artist[];

	    static createFrom(source: any = {}) {
	        return new ArtistPage(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], Artist);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class Track {
	    name: string;
	    uri: string;
	    artists: Artist[];
	    album: Album;
	    duration_ms: number;
	    explicit: boolean;

	    static createFrom(source: any = {}) {
	        return new Track(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uri = source["uri"];
	        this.artists = this.convertValues(source["artists"], Artist);
	        this.album = this.convertValues(source["album"], Album);
	        this.duration_ms = source["duration_ms"];
	        this.explicit = source["explicit"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Queue {
	    currently_playing?: Track;
	    queue: Track[];

	    static createFrom(source: any = {}) {
	        return new Queue(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currently_playing = this.convertValues(source["currently_playing"], Track);
	        this.queue = this.convertValues(source["queue"], Track);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TrackPage {
	    items: Track[];
	    next: string;

	    static createFrom(source: any = {}) {
	        return new TrackPage(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], Track);
	        this.next = source["next"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Results {
	    tracks: TrackPage;
	    artists: ArtistPage;
	    albums: AlbumPage;

	    static createFrom(source: any = {}) {
	        return new Results(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tracks = this.convertValues(source["tracks"], TrackPage);
	        this.artists = this.convertValues(source["artists"], ArtistPage);
	        this.albums = this.convertValues(source["albums"], AlbumPage);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Status {
	    configured: boolean;
	    connected: boolean;
	    pending: boolean;
	    name: string;
	    message: string;
	    redirect: string;

	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configured = source["configured"];
	        this.connected = source["connected"];
	        this.pending = source["pending"];
	        this.name = source["name"];
	        this.message = source["message"];
	        this.redirect = source["redirect"];
	    }
	}


}

export namespace store {

	export class Bookmark {
	    url: string;
	    title: string;
	    added: number;

	    static createFrom(source: any = {}) {
	        return new Bookmark(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.title = source["title"];
	        this.added = source["added"];
	    }
	}
	export class Download {
	    name: string;
	    path: string;
	    time: number;

	    static createFrom(source: any = {}) {
	        return new Download(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.time = source["time"];
	    }
	}
	export class Note {
	    key: string;
	    title: string;
	    text: string;
	    updated: number;

	    static createFrom(source: any = {}) {
	        return new Note(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.title = source["title"];
	        this.text = source["text"];
	        this.updated = source["updated"];
	    }
	}
	export class Visit {
	    url: string;
	    title: string;
	    last: number;
	    visits: number;

	    static createFrom(source: any = {}) {
	        return new Visit(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.title = source["title"];
	        this.last = source["last"];
	        this.visits = source["visits"];
	    }
	}

}

