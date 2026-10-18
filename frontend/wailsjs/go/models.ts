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

export namespace spotify {
	
	export class State {
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

