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

